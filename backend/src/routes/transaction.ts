import { FastifyInstance } from "fastify";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

import { getPayment, markScanned } from "../paymentStore";
import { USDC_MINT, USDC_DECIMALS, RECIPIENT, BASE_URL, toUsdcBaseUnits } from "../constants";
import { connection } from "../connection";
import { TransactionQuery, TransactionBody } from "../types/interface";

export async function transactionRoute(fastify: FastifyInstance) {
  // (1) The wallet fetches the label and icon
  fastify.get<{ Querystring: TransactionQuery }>(
    "/transaction",
    async (request, reply) => {
      const { reference } = request.query;
      fastify.log.info({ step: "1", reference }, "[SEQ] GET /transaction - wallet scanned the QR code, returning label/icon");
      if (reference) markScanned(reference);
      return reply.send({
        label: "Solanya Pay",
        icon: `${BASE_URL}/icon.svg`,
      });
    }
  );

  // (2) The wallet sends the user's public key -> the backend builds and returns the transaction
  fastify.post<{ Querystring: TransactionQuery; Body: TransactionBody }>(
    "/transaction",
    async (request, reply) => {
      const { reference } = request.query;
      const { account } = request.body;

      fastify.log.info({ step: "2", reference, account }, "[SEQ] POST /transaction - wallet sent its public key, building transaction");

      if (!reference) {
        fastify.log.warn("[SEQ] (2) error: missing reference");
        return reply.status(400).send({ error: "reference is required" });
      }
      if (!account) {
        fastify.log.warn("[SEQ] (2) error: missing account");
        return reply.status(400).send({ error: "account is required" });
      }

      const payment = getPayment(reference);
      if (!payment) {
        fastify.log.warn({ reference }, "[SEQ] (2) error: payment request not found (expired or invalid reference)");
        return reply.status(404).send({ error: "Payment request not found or expired" });
      }
      fastify.log.info({ usdcAmount: payment.usdcAmount }, "[SEQ] (2) payment request found");
      markScanned(reference);

      let userPubkey: PublicKey;
      let refPubkey: PublicKey;
      try {
        userPubkey = new PublicKey(account);
        refPubkey = new PublicKey(reference);
      } catch {
        fastify.log.warn("[SEQ] (2) error: failed to parse public key");
        return reply.status(400).send({ error: "Invalid public key" });
      }

      // Resolve the USDC token accounts of the user and the recipient
      const userTokenAccount = await getAssociatedTokenAddress(USDC_MINT, userPubkey);
      const recipientTokenAccount = await getAssociatedTokenAddress(USDC_MINT, RECIPIENT);
      fastify.log.info({ userTokenAccount: userTokenAccount.toBase58(), recipientTokenAccount: recipientTokenAccount.toBase58() }, "[SEQ] (2) token accounts resolved");

      const transferAmount = toUsdcBaseUnits(payment.usdcAmount);
      fastify.log.info({ transferAmount: transferAmount.toString(), usdcAmount: payment.usdcAmount }, "[SEQ] (2) transfer amount calculated");

      const { blockhash } = await connection.getLatestBlockhash();
      fastify.log.info({ blockhash }, "[SEQ] (2) blockhash fetched");

      const tx = new Transaction();
      tx.feePayer = userPubkey; // the user pays the network fee in SOL
      tx.recentBlockhash = blockhash;

      // Create the recipient's ATA if it doesn't exist (needed the first time a new wallet receives USDC)
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          userPubkey,           // pays the account creation fee
          recipientTokenAccount,
          RECIPIENT,
          USDC_MINT
        )
      );

      // USDC transfer instruction (the reference key is attached as a read-only key so the payment can be found on-chain)
      const transferIx = createTransferCheckedInstruction(
        userTokenAccount,  // source
        USDC_MINT,
        recipientTokenAccount, // destination (Solanya Pay recipient wallet)
        userPubkey,            // owner (signer)
        transferAmount,
        USDC_DECIMALS
      );
      transferIx.keys.push({ pubkey: refPubkey, isSigner: false, isWritable: false });
      tx.add(transferIx);

      const simResult = await connection.simulateTransaction(tx);
      if (simResult.value.err) {
        fastify.log.error({ err: simResult.value.err, logs: simResult.value.logs }, "[SEQ] (2) simulation failed");
      } else {
        fastify.log.info({ logs: simResult.value.logs }, "[SEQ] (2) simulation succeeded");
      }

      const serialized = tx.serialize({ requireAllSignatures: false });
      const base64 = serialized.toString("base64");

      fastify.log.info({ usdcAmount: payment.usdcAmount }, "[SEQ] (2) transaction built and returned to the wallet. Next: user approves -> signs -> broadcasts");
      return reply.send({
        transaction: base64,
        message: `Solanya Pay: Send ${payment.usdcAmount} USDC, nya 🐾`,
      });
    }
  );
}

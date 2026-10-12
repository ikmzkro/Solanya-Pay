import { FastifyInstance } from "fastify";
import {
  Connection,
  PublicKey,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

import { getPayment } from "../paymentStore";
import { USDC_MINT, USDC_DECIMALS, RECIPIENT, BASE_URL } from "../constants";
import { TransactionQuery, TransactionBody } from "../types/interface";

const connection = new Connection(
  process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet"),
  "confirmed"
);

export async function transactionRoute(fastify: FastifyInstance) {
  // ① ウォレットがラベル・アイコンを取得
  fastify.get<{ Querystring: TransactionQuery }>(
    "/transaction",
    async (request, reply) => {
      const { reference } = request.query;
      fastify.log.info({ step: "①", reference }, "[SEQ] GET /transaction — ウォレットがQRをスキャン、label/iconを取得");
      return reply.send({
        label: "Solanya Pay",
        icon: `${BASE_URL}/icon.svg`,
      });
    }
  );

  // ② ウォレットがユーザ公開鍵を送信 → バックエンドが Tx を構築して返す
  fastify.post<{ Querystring: TransactionQuery; Body: TransactionBody }>(
    "/transaction",
    async (request, reply) => {
      const { reference } = request.query;
      const { account } = request.body;

      fastify.log.info({ step: "②", reference, account }, "[SEQ] POST /transaction — ウォレットが公開鍵を送信、Tx構築開始");

      if (!reference) {
        fastify.log.warn("[SEQ] ② エラー: reference がない");
        return reply.status(400).send({ error: "reference is required" });
      }
      if (!account) {
        fastify.log.warn("[SEQ] ② エラー: account がない");
        return reply.status(400).send({ error: "account is required" });
      }

      const payment = getPayment(reference);
      if (!payment) {
        fastify.log.warn({ reference }, "[SEQ] ② エラー: 支払いリクエストが見つからない（期限切れ or 不正なreference）");
        return reply.status(404).send({ error: "Payment request not found or expired" });
      }
      fastify.log.info({ usdcAmount: payment.usdcAmount }, "[SEQ] ② 支払いリクエストを取得");

      let userPubkey: PublicKey;
      let refPubkey: PublicKey;
      try {
        userPubkey = new PublicKey(account);
        refPubkey = new PublicKey(reference);
      } catch {
        fastify.log.warn("[SEQ] ② エラー: 公開鍵のパース失敗");
        return reply.status(400).send({ error: "Invalid public key" });
      }

      // ユーザと受取先の USDC トークンアカウントを解決
      const userTokenAccount = await getAssociatedTokenAddress(USDC_MINT, userPubkey);
      const recipientTokenAccount = await getAssociatedTokenAddress(USDC_MINT, RECIPIENT);
      fastify.log.info({ userTokenAccount: userTokenAccount.toBase58(), recipientTokenAccount: recipientTokenAccount.toBase58() }, "[SEQ] ② トークンアカウント解決");

      const transferAmount = BigInt(Math.round(payment.usdcAmount * 10 ** USDC_DECIMALS));
      fastify.log.info({ transferAmount: transferAmount.toString(), usdcAmount: payment.usdcAmount }, "[SEQ] ② 送金額計算");

      const { blockhash } = await connection.getLatestBlockhash();
      fastify.log.info({ blockhash }, "[SEQ] ② blockhash取得");

      const tx = new Transaction();
      tx.feePayer = userPubkey; // ユーザが SOL でガス代を負担
      tx.recentBlockhash = blockhash;

      // 受取先ATAが存在しない場合は作成（新規ウォレットの初回受取時に必要）
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          userPubkey,           // 作成費用の支払者
          recipientTokenAccount,
          RECIPIENT,
          USDC_MINT
        )
      );

      // USDC 送金命令（reference 公開鍵をリードオンリーキーとして付加してポーリング検出を可能にする）
      const transferIx = createTransferCheckedInstruction(
        userTokenAccount,  // 送信元
        USDC_MINT,
        recipientTokenAccount, // 送信先（Solanya Pay 受取ウォレット）
        userPubkey,            // 送信者（署名者）
        transferAmount,
        USDC_DECIMALS
      );
      transferIx.keys.push({ pubkey: refPubkey, isSigner: false, isWritable: false });
      tx.add(transferIx);

      const simResult = await connection.simulateTransaction(tx);
      if (simResult.value.err) {
        fastify.log.error({ err: simResult.value.err, logs: simResult.value.logs }, "[SEQ] ② シミュレーション失敗");
      } else {
        fastify.log.info({ logs: simResult.value.logs }, "[SEQ] ② シミュレーション成功");
      }

      const serialized = tx.serialize({ requireAllSignatures: false });
      const base64 = serialized.toString("base64");

      fastify.log.info({ usdcAmount: payment.usdcAmount }, "[SEQ] ② Tx構築完了 → ウォレットへ返却。次: ユーザが承認→署名→broadcast");
      return reply.send({
        transaction: base64,
        message: `Solanya Pay: ${payment.usdcAmount} USDC 送るにゃ 🐾`,
      });
    }
  );
}

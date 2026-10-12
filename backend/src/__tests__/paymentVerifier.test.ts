import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";
import { isExpectedTransfer, ExpectedTransfer } from "../paymentVerifier";

const mint = Keypair.generate().publicKey;
const recipientTokenAccount = Keypair.generate().publicKey;
const payerTokenAccount = Keypair.generate().publicKey;

const expected: ExpectedTransfer = { recipientTokenAccount, mint, amount: 1_500_000n };

interface Balances {
  pre?: string;
  post: string;
  mint?: PublicKey;
}

function buildTx(recipient: Balances, err: unknown = null): ParsedTransactionWithMeta {
  const balance = (amount: string) => ({
    accountIndex: 1,
    mint: (recipient.mint ?? mint).toBase58(),
    uiTokenAmount: { amount, decimals: 6, uiAmount: null, uiAmountString: "" },
  });
  return {
    slot: 1,
    transaction: {
      signatures: ["sig"],
      message: {
        accountKeys: [
          { pubkey: payerTokenAccount, signer: false, writable: true },
          { pubkey: recipientTokenAccount, signer: false, writable: true },
        ],
        instructions: [],
        recentBlockhash: "",
      },
    },
    meta: {
      err,
      fee: 5000,
      preBalances: [],
      postBalances: [],
      preTokenBalances: recipient.pre === undefined ? [] : [balance(recipient.pre)],
      postTokenBalances: [balance(recipient.post)],
    },
  } as unknown as ParsedTransactionWithMeta;
}

test("accepts a successful transfer that credits the exact amount", () => {
  assert.equal(isExpectedTransfer(buildTx({ pre: "1000000", post: "2500000" }), expected), true);
});

test("treats a newly created recipient token account as a zero pre-balance", () => {
  assert.equal(isExpectedTransfer(buildTx({ post: "1500000" }), expected), true);
});

test("rejects a failed transaction", () => {
  assert.equal(isExpectedTransfer(buildTx({ pre: "0", post: "1500000" }, { InstructionError: [0, "Custom"] }), expected), false);
});

test("rejects a transfer with a different amount", () => {
  assert.equal(isExpectedTransfer(buildTx({ pre: "0", post: "1000000" }), expected), false);
});

test("rejects a transfer of a different token", () => {
  const otherMint = Keypair.generate().publicKey;
  assert.equal(isExpectedTransfer(buildTx({ pre: "0", post: "1500000", mint: otherMint }), expected), false);
});

test("rejects a transaction that does not touch the recipient token account", () => {
  const other = { ...expected, recipientTokenAccount: Keypair.generate().publicKey };
  assert.equal(isExpectedTransfer(buildTx({ pre: "0", post: "1500000" }), other), false);
});

test("rejects a transaction without metadata", () => {
  const tx = { ...buildTx({ post: "1500000" }), meta: null } as ParsedTransactionWithMeta;
  assert.equal(isExpectedTransfer(tx, expected), false);
});

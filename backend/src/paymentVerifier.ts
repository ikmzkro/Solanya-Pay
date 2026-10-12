import { Connection, ParsedTransactionWithMeta, PublicKey, TokenBalance } from "@solana/web3.js";
import { findReference, FindReferenceError } from "@solana/pay";

export interface ExpectedTransfer {
  recipientTokenAccount: PublicKey;
  mint: PublicKey;
  amount: bigint; // in base units
}

// True if the transaction succeeded and credited exactly `amount` to the recipient token account.
// Wallets may add their own instructions, so we check balance changes instead of instruction layout.
export function isExpectedTransfer(tx: ParsedTransactionWithMeta, expected: ExpectedTransfer): boolean {
  if (!tx.meta || tx.meta.err) return false;

  const index = tx.transaction.message.accountKeys.findIndex((key) =>
    key.pubkey.equals(expected.recipientTokenAccount)
  );
  if (index < 0) return false;

  const mint = expected.mint.toBase58();
  const pre = tokenAmountAt(tx.meta.preTokenBalances, index, mint);
  const post = tokenAmountAt(tx.meta.postTokenBalances, index, mint);
  return post - pre === expected.amount;
}

function tokenAmountAt(balances: TokenBalance[] | null | undefined, index: number, mint: string): bigint {
  const balance = balances?.find((b) => b.accountIndex === index && b.mint === mint);
  return balance ? BigInt(balance.uiTokenAmount.amount) : 0n;
}

// Signature of the transaction that includes the reference key, or null if none yet
export async function findPaymentSignature(connection: Connection, reference: PublicKey): Promise<string | null> {
  try {
    const info = await findReference(connection, reference, { finality: "confirmed" });
    return info.signature;
  } catch (error) {
    if (error instanceof FindReferenceError) return null;
    throw error;
  }
}

// Signature of a confirmed transaction that matches the expected transfer, or null
export async function verifyPayment(
  connection: Connection,
  reference: PublicKey,
  expected: ExpectedTransfer
): Promise<string | null> {
  const signature = await findPaymentSignature(connection, reference);
  if (!signature) return null;

  const tx = await connection.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx || !isExpectedTransfer(tx, expected)) return null;
  return signature;
}

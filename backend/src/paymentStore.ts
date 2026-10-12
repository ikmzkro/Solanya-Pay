// waiting: QR shown / scanned: the wallet fetched the transaction / paid: confirmed on-chain
export type PaymentStatus = "waiting" | "scanned" | "paid";

export interface PaymentSession {
  usdcAmount: number;
  reference: string; // base58
  status: PaymentStatus;
  signature?: string;
}

const store = new Map<string, PaymentSession>();

export function savePayment(session: PaymentSession): void {
  store.set(session.reference, session);
}

export function getPayment(reference: string): PaymentSession | undefined {
  return store.get(reference);
}

export function markScanned(reference: string): void {
  const session = store.get(reference);
  if (session?.status === "waiting") session.status = "scanned";
}

export function markPaid(reference: string, signature: string): void {
  const session = store.get(reference);
  if (!session) return;
  session.status = "paid";
  session.signature = signature;
}

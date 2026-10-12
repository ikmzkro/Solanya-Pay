export interface PaymentSession {
  usdcAmount: number;
  reference: string; // base58
}

const store = new Map<string, PaymentSession>();

export function savePayment(session: PaymentSession): void {
  store.set(session.reference, session);
}

export function getPayment(reference: string): PaymentSession | undefined {
  return store.get(reference);
}

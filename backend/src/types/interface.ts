export interface PaymentBody {
  usdc_amount: number;
}

export interface PaymentResponse {
  usdc_amount: number;
  reference: string;
  qr_url: string;
}

export interface TransactionQuery {
  reference?: string;
}

export interface TransactionBody {
  account: string;
}

import { PublicKey } from "@solana/web3.js";

// USDCミントアドレス
// Solanaでは各トークン（USDC等）の「種類の定義」がブロックチェーン上のアカウントとして存在する。
// このアドレスはUSDCの仕様（小数点桁数=6、発行権限者など）を持つアカウントであり、
// 残高が入っている場所ではない。
//
// ユーザのUSDC残高は「USDC_MINT + ユーザの公開鍵」から導出される
// Associated Token Account (ATA) に格納されている。
// → getAssociatedTokenAddress(USDC_MINT, userPubkey) で計算できる。
//
// TODO: mainnet移行時は mainnet-beta公式アドレス(EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)へ変更すること
export const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

// TODO: 本番の受取ウォレットのアドレスを RECIPIENT_PUBKEY 環境変数に設定すること
//       未設定時はシステムプログラムアドレス(1111...1)へ送金されるため必ず設定すること
if (!process.env.RECIPIENT_PUBKEY) {
  throw new Error("RECIPIENT_PUBKEY is not set in .env");
}
export const RECIPIENT = new PublicKey(process.env.RECIPIENT_PUBKEY);

// USDCの小数点桁数（Solana上で常に6桁固定）
export const USDC_DECIMALS = 6;

// バックエンドの公開URL（本番は環境変数で上書き）
export const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";


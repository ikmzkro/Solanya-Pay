import { PublicKey } from "@solana/web3.js";

// USDC mint address
// On Solana, each token type (such as USDC) is defined by an on-chain mint account.
// This account holds the token's spec (decimals = 6, mint authority, etc.),
// not anyone's balance.
//
// A user's USDC balance lives in the Associated Token Account (ATA)
// derived from USDC_MINT + the user's public key.
// -> getAssociatedTokenAddress(USDC_MINT, userPubkey)
//
// TODO: switch to the official mainnet-beta mint (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v) for mainnet
export const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

// Wallet that receives USDC. Set RECIPIENT_PUBKEY in .env (the server refuses to start without it)
if (!process.env.RECIPIENT_PUBKEY) {
  throw new Error("RECIPIENT_PUBKEY is not set in .env");
}
export const RECIPIENT = new PublicKey(process.env.RECIPIENT_PUBKEY);

// USDC decimals (always 6 on Solana)
export const USDC_DECIMALS = 6;

// Public URL of the backend (overridden by BASE_URL)
export const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";


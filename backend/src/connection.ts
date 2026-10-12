import { Connection, clusterApiUrl } from "@solana/web3.js";

export const connection = new Connection(
  process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet"),
  "confirmed"
);

import { FastifyInstance } from "fastify";
import { Keypair } from "@solana/web3.js";
import { encodeURL } from "@solana/pay";
import { savePayment } from "../paymentStore";
import { PaymentBody } from "../types/interface";
import { BASE_URL } from "../constants";

export async function paymentRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: PaymentBody }>("/payment", async (request, reply) => {
    const { usdc_amount } = request.body;

    if (!usdc_amount || usdc_amount <= 0) {
      return reply.status(400).send({ error: "usdc_amount must be a positive number" });
    }

    const reference = Keypair.generate().publicKey;
    const ref58 = reference.toBase58();

    // Save the payment request (looked up by the /transaction endpoint)
    savePayment({ usdcAmount: usdc_amount, reference: ref58 });

    // Transaction Request URL: solana:https://...
    const link = new URL(`${BASE_URL}/transaction`);
    link.searchParams.set("reference", ref58);

    const qr_url = encodeURL({ link }).toString();

    return reply.send({
      usdc_amount,
      reference: ref58,
      qr_url,
    });
  });
}

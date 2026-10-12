import { FastifyInstance } from "fastify";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getPayment, markPaid, PaymentSession } from "../paymentStore";
import { verifyPayment, ExpectedTransfer } from "../paymentVerifier";
import { connection } from "../connection";
import { USDC_MINT, RECIPIENT, toUsdcBaseUnits } from "../constants";

function expectedTransferFor(payment: PaymentSession): ExpectedTransfer {
  return {
    recipientTokenAccount: getAssociatedTokenAddressSync(USDC_MINT, RECIPIENT),
    mint: USDC_MINT,
    amount: toUsdcBaseUnits(payment.usdcAmount),
  };
}

// The browser polls this while the QR code is shown
export async function paymentStatusRoute(fastify: FastifyInstance) {
  fastify.get<{ Params: { reference: string } }>(
    "/payment/:reference/status",
    async (request, reply) => {
      const payment = getPayment(request.params.reference);
      if (!payment) {
        return reply.status(404).send({ error: "Payment request not found or expired" });
      }

      if (payment.status !== "paid") {
        try {
          const signature = await verifyPayment(connection, new PublicKey(payment.reference), expectedTransferFor(payment));
          if (signature) {
            markPaid(payment.reference, signature);
            fastify.log.info({ reference: payment.reference, signature }, "[SEQ] (3) payment confirmed on-chain");
          }
        } catch (error) {
          fastify.log.error({ err: error, reference: payment.reference }, "[SEQ] (3) failed to check payment status");
          return reply.status(502).send({ error: "Failed to check payment status" });
        }
      }

      return reply.send({
        status: payment.status,
        signature: payment.signature,
        usdc_amount: payment.usdcAmount,
      });
    }
  );
}

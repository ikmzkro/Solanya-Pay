import "./env";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import { paymentRoute } from "./routes/payment";
import { paymentStatusRoute } from "./routes/paymentStatus";
import { transactionRoute } from "./routes/transaction";

const fastify = Fastify({ logger: true });

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "../public"),
  prefix: "/",
});

fastify.register(paymentRoute);
fastify.register(paymentStatusRoute);
fastify.register(transactionRoute);

const PORT = 3000;

fastify.listen(
  {
    port: PORT,
    host: "localhost",
    // "localhost" listens on both IPv4 and IPv6, so always log it as localhost
    listenTextResolver: () => `Server listening at http://localhost:${PORT}`,
  },
  (err) => {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  }
);

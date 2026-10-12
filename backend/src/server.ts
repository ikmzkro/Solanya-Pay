import "./env";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import { paymentRoute } from "./routes/payment";
import { transactionRoute } from "./routes/transaction";

const fastify = Fastify({ logger: true });

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "../public"),
  prefix: "/",
});

fastify.register(paymentRoute);
fastify.register(transactionRoute);

const PORT = 3000;

fastify.listen(
  {
    port: PORT,
    host: "localhost",
    // localhost は IPv4/IPv6 の両方で待ち受けるため、ログは localhost 表記に揃える
    listenTextResolver: () => `Server listening at http://localhost:${PORT}`,
  },
  (err) => {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  }
);

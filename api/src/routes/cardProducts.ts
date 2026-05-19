import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { highnote, cardProductId } from "../services/highnote.js";
import { HighnoteUserError, HighnoteAccessDeniedError } from "@highnote-oss/nodejs-sdk";

export async function cardProductRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // List card products from Highnote (public / no auth required)
  typedApp.get("/api/card-products", {
    schema: {
      tags: ["Card Products"],
      description: "List available card products from Highnote catalog",
    },
  }, async (_request, reply) => {
    try {
      const products = [];
      for await (const product of highnote.cardProducts.list()) {
        products.push(product);
      }
      return { data: products };
    } catch (err) {
      if (err instanceof HighnoteUserError) {
        return reply.status(400).send({
          error: "Highnote validation error",
          fieldErrors: err.fieldErrors,
        });
      }
      if (err instanceof HighnoteAccessDeniedError) {
        return reply.status(403).send({ error: "Access denied", message: err.message });
      }
      throw err;
    }
  });
}

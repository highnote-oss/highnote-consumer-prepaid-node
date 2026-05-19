import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { highnote } from "../services/highnote.js";
import { HighnoteUserError, HighnoteAccessDeniedError } from "@highnote-oss/nodejs-sdk";
import { IdParamsSchema } from "../types.js";
import { getUserResourceIds } from "../middleware/auth.js";

export async function clientTokenRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Generate a client token for setting a card's PIN
  typedApp.post("/api/cards/:id/pin-token", {
    schema: {
      tags: ["Client Tokens"],
      description: "Generate a scoped client token for setting a payment card's PIN via the Secure Inputs SDK",
      params: IdParamsSchema,
    },
  }, async (request, reply) => {
    try {
      const { cardIds } = await getUserResourceIds(request);
      if (!cardIds.has(request.params.id)) {
        return reply.status(403).send({ error: "Card does not belong to this user" });
      }
      const token = await highnote.clientTokens.createForPaymentCard({
        paymentCardId: request.params.id,
        permissions: ["SET_PAYMENT_CARD_PIN" as any],
      });
      return token;
    } catch (err) {
      if (err instanceof HighnoteUserError) {
        return reply.status(400).send({ error: "Highnote validation error", fieldErrors: err.fieldErrors });
      }
      if (err instanceof HighnoteAccessDeniedError) {
        return reply.status(403).send({ error: "Access denied", message: err.message });
      }
      throw err;
    }
  });

  // Generate a client token for viewing card details (card number, CVV, expiry)
  typedApp.post("/api/cards/:id/viewer-token", {
    schema: {
      tags: ["Client Tokens"],
      description: "Generate a scoped client token for viewing payment card restricted details via the Card Viewer SDK",
      params: IdParamsSchema,
    },
  }, async (request, reply) => {
    try {
      const { cardIds } = await getUserResourceIds(request);
      if (!cardIds.has(request.params.id)) {
        return reply.status(403).send({ error: "Card does not belong to this user" });
      }
      const token = await highnote.clientTokens.createForPaymentCard({
        paymentCardId: request.params.id,
        permissions: ["READ_RESTRICTED_DETAILS" as any],
      });
      return token;
    } catch (err) {
      if (err instanceof HighnoteUserError) {
        return reply.status(400).send({ error: "Highnote validation error", fieldErrors: err.fieldErrors });
      }
      if (err instanceof HighnoteAccessDeniedError) {
        return reply.status(403).send({ error: "Access denied", message: err.message });
      }
      throw err;
    }
  });
}

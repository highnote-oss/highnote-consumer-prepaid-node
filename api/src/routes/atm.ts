import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { highnote } from "../services/highnote.js";
import { HighnoteUserError, HighnoteAccessDeniedError } from "@highnote-oss/nodejs-sdk";
import { FindATMLocationsBodySchema } from "../types.js";

function handleError(err: unknown, reply: any) {
  if (err instanceof HighnoteUserError) {
    return reply.status(400).send({ error: "Highnote validation error", fieldErrors: err.fieldErrors });
  }
  if (err instanceof HighnoteAccessDeniedError) {
    return reply.status(403).send({ error: "Access denied", message: err.message });
  }
  throw err;
}

export async function atmRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post("/api/atm/find", {
    schema: {
      tags: ["ATM"],
      description: "Find ATM locations near coordinates for a payment card",
      body: FindATMLocationsBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { cardId, latitude, longitude, radiusMiles, limit } = request.body;
      const locations = await highnote.cards.findATMLocations({
        paymentCardId: cardId,
        latitude,
        longitude,
        radiusMiles,
        limit,
      });
      return { data: locations };
    } catch (err) {
      return handleError(err, reply);
    }
  });
}

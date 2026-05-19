import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { highnote } from "../services/highnote.js";

export async function meRoute(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Get the logged-in user's account holder with all nested resources
  typedApp.get("/api/me", {
    schema: {
      tags: ["Auth"],
      description: "Get the logged-in user's account holder with financial accounts and cards",
    },
  }, async (request, reply) => {
    const accountHolderHnId = request.user.accountHolderId;
    if (!accountHolderHnId) {
      return {
        user: { id: request.user.id, email: request.user.email },
        accountHolder: null,
      };
    }

    try {
      const accountHolder = await highnote.accountHolders.get(accountHolderHnId);
      return {
        user: { id: request.user.id, email: request.user.email },
        accountHolder,
      };
    } catch (err) {
      request.log.error(err, "Failed to fetch account holder from Highnote");
      throw err;
    }
  });
}

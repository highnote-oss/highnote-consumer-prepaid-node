import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { highnote } from "../services/highnote.js";
import { HighnoteUserError, HighnoteAccessDeniedError } from "@highnote-oss/nodejs-sdk";
import { TransactionQuerySchema } from "../types.js";
import { getUserResourceIds } from "../middleware/auth.js";
import { z } from "zod";

const ActivityQuerySchema = z.object({
  financialAccountId: z.string().min(1, "financialAccountId is required"),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export async function transactionRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // List financial account activities — scoped to user's accounts
  typedApp.get("/api/transactions", {
    schema: {
      tags: ["Transactions"],
      description: "List financial account activities for a specific account",
      querystring: ActivityQuerySchema,
    },
  }, async (request, reply) => {
    try {
      const { financialAccountId, pageSize } = request.query;
      const { financialAccountIds } = await getUserResourceIds(request);

      if (!financialAccountIds.has(financialAccountId)) {
        return reply.status(403).send({ error: "Financial account does not belong to this user" });
      }

      const activities = [];
      for await (const activity of highnote.financialAccounts.listActivities(financialAccountId, { pageSize })) {
        activities.push(activity);
        if (activities.length >= pageSize) break;
      }

      return { data: activities };
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

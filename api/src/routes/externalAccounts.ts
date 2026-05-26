import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { highnote } from "../services/highnote.js";
import { HighnoteUserError, HighnoteAccessDeniedError } from "@highnote-oss/nodejs-sdk";
import {
  AddPlaidBankAccountBodySchema,
  AddFinicityBankAccountBodySchema,
  AddNonVerifiedBankAccountBodySchema,
} from "../types.js";
import { getUserAccountHolderId, addExternalAccountToResourceCache } from "../middleware/auth.js";

function handleError(err: unknown, reply: any) {
  if (err instanceof HighnoteUserError) {
    console.error("Highnote UserError:", JSON.stringify(err.fieldErrors, null, 2));
    return reply.status(400).send({ error: "Highnote validation error", fieldErrors: err.fieldErrors });
  }
  if (err instanceof HighnoteAccessDeniedError) {
    return reply.status(403).send({ error: "Access denied", message: err.message });
  }
  throw err;
}

export async function externalAccountRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post("/api/external-accounts/plaid", {
    schema: {
      tags: ["External Accounts"],
      description: "Link a bank account verified through Plaid",
      body: AddPlaidBankAccountBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { accountHolderId, processorToken } = request.body;
      if (accountHolderId !== getUserAccountHolderId(request)) {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const result = await highnote.externalAccounts.addVerifiedThroughPlaid({
        accountHolderId,
        externalToken: { value: processorToken },
      });
      addExternalAccountToResourceCache(accountHolderId, result.id);
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/external-accounts/finicity", {
    schema: {
      tags: ["External Accounts"],
      description: "Link a bank account verified through Finicity",
      body: AddFinicityBankAccountBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { accountHolderId, name, bankAccountType, receiptId, customerId } = request.body;
      if (accountHolderId !== getUserAccountHolderId(request)) {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const start = new Date().toISOString();
      const result = await highnote.externalAccounts.addVerifiedThroughFinicity({
        accountHolderId,
        name,
        bankAccountType: bankAccountType as any,
        externalToken: {
          receiptId,
          customerId,
          products: [
            { accountId: customerId, callLimit: 1, expirationDetail: { start, expiry }, productType: "ACH_DETAILS" as any },
            { accountId: customerId, callLimit: 1, expirationDetail: { start, expiry }, productType: "CURRENT_BALANCE" as any },
            { accountId: customerId, callLimit: 1, expirationDetail: { start, expiry }, productType: "ACH_OWNER_DETAILS" as any },
          ],
        },
      });
      addExternalAccountToResourceCache(accountHolderId, result.id);
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/external-accounts/non-verified", {
    schema: {
      tags: ["External Accounts"],
      description: "Link a non-verified bank account (routing + account number)",
      body: AddNonVerifiedBankAccountBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { accountHolderId, routingNumber, accountNumber, bankAccountType, name } = request.body;
      if (accountHolderId !== getUserAccountHolderId(request)) {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const result = await highnote.externalAccounts.addNonVerified({
        accountHolderId,
        routingNumber,
        accountNumber,
        bankAccountType: bankAccountType as any,
        ...(name && { name }),
      });
      addExternalAccountToResourceCache(accountHolderId, result.id);
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });
}

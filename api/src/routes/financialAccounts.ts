import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { highnote } from "../services/highnote.js";
import { HighnoteUserError, HighnoteAccessDeniedError, FinancialAccountSuspensionReasonInput } from "@highnote-oss/nodejs-sdk";
import {
  IssueFinancialAccountBodySchema,
  SuspendFinancialAccountBodySchema,
  UnsuspendFinancialAccountBodySchema,
  IdParamsSchema,
} from "../types.js";
import { getUserAccountHolderId, getUserResourceIds, addAccountToResourceCache } from "../middleware/auth.js";

export async function financialAccountRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Issue financial account from an approved application
  typedApp.post("/api/financial-accounts", {
    schema: {
      tags: ["Financial Accounts"],
      description: "Issue a financial account from an approved application",
      body: IssueFinancialAccountBodySchema,
    },
  }, async (request, reply) => {
    try {
      const ahId = getUserAccountHolderId(request);

      // Verify the application belongs to this user's account holder
      const application = await highnote.applications.get(request.body.applicationId);
      const snapshot = application.accountHolderSnapshot;
      const snapshotAhId =
        snapshot?.__typename === "USPersonAccountHolderSnapshot"
          ? snapshot.accountHolderCurrent?.id
          : undefined;
      if (snapshotAhId !== ahId) {
        return reply.status(403).send({ error: "Application does not belong to this user" });
      }

      const account = await highnote.financialAccounts.issue({
        applicationId: request.body.applicationId,
        name: request.body.name,
      });

      addAccountToResourceCache(ahId, account.id);
      return reply.status(201).send(account);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // Get financial account
  typedApp.get("/api/financial-accounts/:id", {
    schema: {
      tags: ["Financial Accounts"],
      description: "Get a financial account by Highnote ID (includes payment cards)",
      params: IdParamsSchema,
    },
  }, async (request, reply) => {
    try {
      const { financialAccountIds } = await getUserResourceIds(request);
      if (!financialAccountIds.has(request.params.id)) {
        return reply.status(403).send({ error: "Financial account does not belong to this user" });
      }
      const account = await highnote.financialAccounts.get(request.params.id);
      return account;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // List scheduled transfers for a financial account
  typedApp.get("/api/financial-accounts/:id/scheduled-transfers", {
    schema: {
      tags: ["Financial Accounts"],
      description: "List scheduled ACH transfers for a financial account",
      params: IdParamsSchema,
    },
  }, async (request, reply) => {
    try {
      const { financialAccountIds } = await getUserResourceIds(request);
      if (!financialAccountIds.has(request.params.id)) {
        return reply.status(403).send({ error: "Financial account does not belong to this user" });
      }
      const account = await highnote.financialAccounts.get(request.params.id);
      return { data: (account as any).incomingScheduledTransfers?.edges?.map((e: any) => e.node) ?? [] };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // List wire transfer review workflow events for a financial account
  typedApp.get("/api/financial-accounts/:id/wire-transfers", {
    schema: {
      tags: ["Financial Accounts"],
      description: "List wire transfer review workflow events for a financial account",
      params: IdParamsSchema,
    },
  }, async (request, reply) => {
    try {
      const { financialAccountIds } = await getUserResourceIds(request);
      if (!financialAccountIds.has(request.params.id)) {
        return reply.status(403).send({ error: "Financial account does not belong to this user" });
      }

      const events = [];
      for await (const event of highnote.financialAccounts.listReviewWorkflowEvents(request.params.id)) {
        events.push(event);
        if (events.length >= 50) break;
      }

      return { data: events };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // Suspend a financial account
  typedApp.post("/api/financial-accounts/:id/suspend", {
    schema: {
      tags: ["Financial Accounts"],
      description: "Suspend a financial account",
      params: IdParamsSchema,
      body: SuspendFinancialAccountBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { financialAccountIds } = await getUserResourceIds(request);
      if (!financialAccountIds.has(request.params.id)) {
        return reply.status(403).send({ error: "Financial account does not belong to this user" });
      }
      const result = await highnote.financialAccounts.suspend({
        id: request.params.id,
        memo: request.body.memo,
        suspensionReason: request.body.suspensionReason as FinancialAccountSuspensionReasonInput,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // Unsuspend a financial account
  typedApp.post("/api/financial-accounts/:id/unsuspend", {
    schema: {
      tags: ["Financial Accounts"],
      description: "Unsuspend a financial account",
      params: IdParamsSchema,
      body: UnsuspendFinancialAccountBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { financialAccountIds } = await getUserResourceIds(request);
      if (!financialAccountIds.has(request.params.id)) {
        return reply.status(403).send({ error: "Financial account does not belong to this user" });
      }
      const result = await highnote.financialAccounts.unsuspend({
        id: request.params.id,
        memo: request.body.memo,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });
}

function handleError(err: unknown, reply: any) {
  if (err instanceof HighnoteUserError) {
    return reply.status(400).send({ error: "Highnote validation error", fieldErrors: err.fieldErrors });
  }
  if (err instanceof HighnoteAccessDeniedError) {
    return reply.status(403).send({ error: "Access denied", message: err.message });
  }
  throw err;
}

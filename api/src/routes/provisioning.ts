import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { createHash } from "crypto";
import { highnote, cardProductId } from "../services/highnote.js";
import { HighnoteUserError, HighnoteAccessDeniedError, ProvisionAccountHolderAction } from "@highnote-oss/nodejs-sdk";
import { ProvisionBodySchema } from "../types.js";

export async function provisioningRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post("/api/provision", {
    schema: {
      tags: ["Provisioning"],
      description: "Provision an account holder: create application + issue financial account in one call",
      body: ProvisionBodySchema,
    },
  }, async (request, reply) => {
    try {
      const accountHolderHnId = request.user.accountHolderId;
      if (!accountHolderHnId) {
        return reply.status(400).send({ error: "You must complete onboarding first" });
      }

      const productId = request.body.cardProductId || cardProductId;
      if (!productId) {
        return reply.status(400).send({
          error: "cardProductId is required (pass in body or set HIGHNOTE_CARD_PRODUCT_ID env var)",
        });
      }

      const financialAccountName = request.body.financialAccountName || "My Card Account";

      const hashHex = createHash("sha256")
        .update(`provision-v1-${accountHolderHnId}-${request.body.cardProductId || "default"}`)
        .digest("hex")
        .slice(0, 32);
      const idempotencyKey = [
        hashHex.slice(0, 8),
        hashHex.slice(8, 12),
        hashHex.slice(12, 16),
        hashHex.slice(16, 20),
        hashHex.slice(20, 32),
      ].join("-");

      const provisioning = await highnote.provisioning.create({
        accountHolderId: accountHolderHnId,
        idempotencyKey,
        actions: [
          ProvisionAccountHolderAction.CREATE_APPLICATION,
          ProvisionAccountHolderAction.ISSUE_FINANCIAL_ACCOUNT,
        ],
        actionInput: {
          createAccountHolderCardProductApplicationInput: {
            cardProductId: productId,
            cardHolderAgreementConsent: {
              consentTimestamp: new Date().toISOString(),
              primaryAuthorizedPersonId: accountHolderHnId,
            },
          },
          issueFinancialAccountForApplicationInput: {
            name: financialAccountName,
          },
        },
      });

      return reply.status(201).send(provisioning);
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

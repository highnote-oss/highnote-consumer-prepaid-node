import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { randomUUID } from "crypto";
import { highnote } from "../services/highnote.js";
import { HighnoteUserError, HighnoteAccessDeniedError } from "@highnote-oss/nodejs-sdk";
import {
  SimulateAuthorizeBodySchema,
  SimulateClearBodySchema,
  SimulateAuthAndClearBodySchema,
  SimulateReverseBodySchema,
  SimulateRefundBodySchema,
  SimulateAdjustBodySchema,
  SimulateVerifyBodySchema,
  SimulateDepositBodySchema,
  SimulateAppStatusBodySchema,
  SimulateAppVerificationBodySchema,
  SimulateDocReviewBodySchema,
  SimulateDocUploadSessionsBodySchema,
  SimulateAchProcessingBodySchema,
  SimulateAchReturnBodySchema,
  SimulateExternallyInitiatedAchBodySchema,
  SimulateNonOriginatedAchBodySchema,
  SimulatePhysicalCardOrderIdBodySchema,
  SimulatePhysicalCardShipBodySchema,
  SimulateFinancialAccountBodySchema,
} from "../types.js";

/** Convert dollar amount to Highnote AmountInput (minor units / cents). */
function toAmount(dollars: number) {
  return { value: Math.round(dollars * 100), currencyCode: "USD" as any };
}

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

export async function simulateRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // --- Transactions ---

  typedApp.post("/api/simulate/transactions/authorize", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate a card authorization",
      body: SimulateAuthorizeBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { cardId, amount, merchantName, categoryCode } = request.body;
      const result = await highnote.test.transactions.authorize({
        cardId,
        amount: toAmount(amount),
        ...(merchantName || categoryCode ? {
          merchantDetails: {
            ...(merchantName && { name: merchantName }),
            ...(categoryCode && { category: categoryCode as any }),
          },
        } : {}),
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/transactions/verify", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate an account verification ($0 authorization)",
      body: SimulateVerifyBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { cardId, amount, merchantName } = request.body;
      const result = await highnote.test.transactions.verify({
        cardId,
        ...(amount !== undefined ? { amount: toAmount(amount) } : {}),
        ...(merchantName ? { merchantDetails: { name: merchantName } } : {}),
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/transactions/clear", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate a transaction clearing",
      body: SimulateClearBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { transactionId, amount } = request.body;
      const result = await highnote.test.transactions.clear({
        transactionId,
        ...(amount !== undefined && { amount: toAmount(amount) }),
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/transactions/auth-and-clear", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate a single-step auth and clear",
      body: SimulateAuthAndClearBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { cardId, amount, merchantName, categoryCode } = request.body;
      const result = await highnote.test.transactions.authAndClear({
        cardId,
        amount: toAmount(amount),
        ...(merchantName || categoryCode ? {
          merchantDetails: {
            ...(merchantName && { name: merchantName }),
            ...(categoryCode && { category: categoryCode as any }),
          },
        } : {}),
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/transactions/reverse", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate a transaction reversal",
      body: SimulateReverseBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { transactionId, amount } = request.body;
      const result = await highnote.test.transactions.reverse({
        transactionId,
        ...(amount !== undefined && { amount: toAmount(amount) }),
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/transactions/refund", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate a transaction refund",
      body: SimulateRefundBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { transactionId } = request.body;
      const result = await highnote.test.transactions.refund({
        transactionId,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/transactions/adjust", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate a transaction adjustment (credit or debit)",
      body: SimulateAdjustBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { transactionId, amount, adjustmentType } = request.body;
      const result = await highnote.test.transactions.adjust({
        transactionId,
        amount: toAmount(amount),
        transactionProcessingType: adjustmentType as any,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // --- Deposits ---

  typedApp.post("/api/simulate/deposits", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate a wire deposit into a financial account",
      body: SimulateDepositBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { financialAccountId, amount, memo } = request.body;
      const result = await highnote.test.deposits.create({
        toFinancialAccountId: financialAccountId,
        amount: toAmount(amount),
        source: "WIRE" as any,
        ...(memo && { memo }),
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // --- Applications ---

  typedApp.post("/api/simulate/applications/status", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate an application status change",
      body: SimulateAppStatusBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { applicationId, newStatus } = request.body;
      const result = await highnote.test.applications.changeStatus({
        applicationId,
        newApplicationStatus: newStatus as any,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/applications/verification-status", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate an applicant verification status change",
      body: SimulateAppVerificationBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { applicantId, applicationId, newStatus } = request.body;
      const result = await highnote.test.applications.changeVerificationStatus({
        applicantId,
        applicationId,
        newVerificationStatus: newStatus as any,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/applications/document-review", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate a document review status change",
      body: SimulateDocReviewBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { applicationId, documentUploadLinkId, documentUploadSessionId, newReviewStatus } = request.body;
      const result = await highnote.test.applications.reviewDocument({
        applicationId,
        documentUploadLinkId,
        documentUploadSessionId,
        newReviewStatus: newReviewStatus as any,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/applications/document-upload-sessions", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate creating document upload sessions for an application",
      body: SimulateDocUploadSessionsBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { applicationId, memo, requestedDocuments } = request.body;
      const result = await highnote.test.applications.createDocumentUploadSessions({
        applicationId,
        ...(memo && { memo }),
        requestedDocuments: requestedDocuments.map((rd) => ({
          applicantId: rd.applicantId,
          documentTypes: rd.documentTypes as any[],
        })),
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // --- ACH ---

  typedApp.post("/api/simulate/ach/processing", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate ACH transfer processing",
      body: SimulateAchProcessingBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { transferId } = request.body;
      const result = await highnote.test.ach.simulateProcessing({
        id: transferId,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/ach/return", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate ACH transfer return",
      body: SimulateAchReturnBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { transferId, statusFailureReason } = request.body;
      const result = await highnote.test.ach.simulateReturn({
        id: transferId,
        statusFailureReason: statusFailureReason as any,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/ach/externally-initiated", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate an externally-initiated ACH transfer",
      body: SimulateExternallyInitiatedAchBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { financialAccountId, amount } = request.body;
      const result = await highnote.test.ach.simulateExternallyInitiated({
        financialAccountId,
        amount: toAmount(amount),
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/ach/non-originated", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate a non-originated ACH transfer",
      body: SimulateNonOriginatedAchBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { financialAccountId, amount, companyName, purpose } = request.body;
      const result = await highnote.test.ach.simulateNonOriginated({
        financialAccountId,
        amount: toAmount(amount),
        companyName: companyName ?? "TEST COMPANY",
        companyEntryDescription: "PAYMENT",
        companyIdentifier: "1234567890",
        individualName: "TEST RECEIVER",
        purpose: (purpose ?? "DEPOSIT") as any,
        idempotencyKey: randomUUID(),
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // --- Physical Cards ---

  typedApp.post("/api/simulate/physical-cards/send-to-printer", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate sending a physical card order to printer",
      body: SimulatePhysicalCardOrderIdBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { physicalPaymentCardOrderId } = request.body;
      const result = await highnote.test.physicalCards.sendToPrinter({
        physicalPaymentCardOrderId,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/physical-cards/approve", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate approving a physical card order",
      body: SimulatePhysicalCardOrderIdBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { physicalPaymentCardOrderId } = request.body;
      const result = await highnote.test.physicalCards.approve({
        physicalPaymentCardOrderId,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/physical-cards/ship", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate shipping a physical card order",
      body: SimulatePhysicalCardShipBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { physicalPaymentCardOrderId, trackingNumber, actualShipDate } = request.body;
      const result = await highnote.test.physicalCards.ship({
        physicalPaymentCardOrderId,
        ...(trackingNumber && { trackingNumber }),
        ...(actualShipDate && { actualShipDate }),
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/physical-cards/fail-shipment", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate a physical card shipment failure",
      body: SimulatePhysicalCardOrderIdBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { physicalPaymentCardOrderId } = request.body;
      const result = await highnote.test.physicalCards.failShipment({
        physicalPaymentCardOrderId,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // --- Financial Accounts ---

  typedApp.post("/api/simulate/financial-accounts/initiate-closure", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate initiating financial account closure (move to PENDING_CLOSURE)",
      body: SimulateFinancialAccountBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { financialAccountId } = request.body;
      const result = await highnote.test.financialAccounts.initiateClosure({
        financialAccountId,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  typedApp.post("/api/simulate/financial-accounts/close", {
    schema: {
      tags: ["Simulation"],
      description: "Simulate closing a financial account (move to CLOSED)",
      body: SimulateFinancialAccountBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { financialAccountId } = request.body;
      const result = await highnote.test.financialAccounts.close({
        financialAccountId,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });
}

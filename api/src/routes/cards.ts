import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { randomUUID } from "crypto";
import { highnote } from "../services/highnote.js";
import { HighnoteUserError, HighnoteAccessDeniedError } from "@highnote-oss/nodejs-sdk";
import { IssueCardBodySchema, ReissueCardBodySchema, IdParamsSchema, OrderPhysicalCardBodySchema } from "../types.js";
import { getUserResourceIds, addCardToResourceCache, getUserAccountHolderId } from "../middleware/auth.js";

export async function cardRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();


  // Issue a card for a financial account
  typedApp.post("/api/cards", {
    schema: {
      tags: ["Cards"],
      description: "Issue a payment card for a financial account",
      body: IssueCardBodySchema,
    },
  }, async (request, reply) => {
    try {
      const body = request.body;
      const { financialAccountIds } = await getUserResourceIds(request);
      if (!financialAccountIds.has(body.financialAccountId)) {
        return reply.status(403).send({ error: "Financial account does not belong to this user" });
      }

      // Default expiration: ~2 years from now
      const defaultExpiry = new Date();
      defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 2);

      const card = await highnote.cards.issue({
        financialAccountId: body.financialAccountId,
        options: {
          activateOnCreate: body.activateOnCreate ?? false,
          expirationDate: body.expirationDate ?? defaultExpiry.toISOString(),
        },
      });

      addCardToResourceCache(getUserAccountHolderId(request), card.id);
      return reply.status(201).send(card);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // Activate a card
  typedApp.post("/api/cards/:id/activate", {
    schema: {
      tags: ["Cards"],
      description: "Activate a payment card",
      params: IdParamsSchema,
    },
  }, async (request, reply) => {
    try {
      const { cardIds } = await getUserResourceIds(request);
      if (!cardIds.has(request.params.id)) {
        return reply.status(403).send({ error: "Card does not belong to this user" });
      }
      const result = await highnote.cards.activate({
        paymentCardId: request.params.id,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // Suspend a card
  typedApp.post("/api/cards/:id/suspend", {
    schema: {
      tags: ["Cards"],
      description: "Suspend a payment card",
      params: IdParamsSchema,
    },
  }, async (request, reply) => {
    try {
      const { cardIds } = await getUserResourceIds(request);
      if (!cardIds.has(request.params.id)) {
        return reply.status(403).send({ error: "Card does not belong to this user" });
      }
      const result = await highnote.cards.suspend({
        paymentCardId: request.params.id,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // Close a card permanently
  typedApp.post("/api/cards/:id/close", {
    schema: {
      tags: ["Cards"],
      description: "Close a payment card permanently",
      params: IdParamsSchema,
    },
  }, async (request, reply) => {
    try {
      const { cardIds } = await getUserResourceIds(request);
      if (!cardIds.has(request.params.id)) {
        return reply.status(403).send({ error: "Card does not belong to this user" });
      }
      const result = await highnote.cards.close({
        paymentCardId: request.params.id,
      });
      return result;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // Reissue a card (lost/damaged/expiring → reissue, stolen → close + issue new)
  typedApp.post("/api/cards/:id/reissue", {
    schema: {
      tags: ["Cards"],
      description: "Reissue a payment card. Lost/damaged/expiring: reissues (same PAN, new CVV + expiry). Stolen: closes original and issues a brand new card.",
      params: IdParamsSchema,
      body: ReissueCardBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { cardIds, financialAccountIds } = await getUserResourceIds(request);
      if (!cardIds.has(request.params.id)) {
        return reply.status(403).send({ error: "Card does not belong to this user" });
      }
      const { reason, cardLostDate, activateOnCreate, financialAccountId, copyNumber, copyPin } = request.body;

      if (reason === "STOLEN") {
        // Stolen: close the compromised card, issue a completely new one
        await highnote.cards.close({ paymentCardId: request.params.id });

        if (!financialAccountId) {
          return reply.status(400).send({ error: "financialAccountId is required for stolen card replacement" });
        }

        if (!financialAccountIds.has(financialAccountId)) {
          return reply.status(403).send({ error: "Financial account does not belong to this user" });
        }

        const defaultExpiry = new Date();
        defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 2);

        try {
          const newCard = await highnote.cards.issue({
            financialAccountId,
            options: {
              activateOnCreate,
              expirationDate: defaultExpiry.toISOString(),
            },
          });

          addCardToResourceCache(getUserAccountHolderId(request), newCard.id);
          return reply.status(201).send(newCard);
        } catch (issueErr) {
          // Original card is already closed — communicate this clearly
          return reply.status(500).send({
            error: "Original card was closed but replacement could not be issued. Please issue a new card manually.",
          });
        }
      }

      // Lost/other/expiring: reissue (same PAN if copyNumber, new CVV + expiry)
      const defaultExpiry = new Date();
      defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 2);
      // When copying PAN, expiry must differ from original card's month/year
      if (copyNumber) {
        defaultExpiry.setMonth(defaultExpiry.getMonth() + 1);
      }

      const newCard = await highnote.cards.reissue({
        originalPaymentCardId: request.params.id,
        options: {
          activateOnCreate,
          expirationDate: defaultExpiry.toISOString(),
          reason: reason as any,
          ...(cardLostDate && { cardLostDate }),
          reissueFeatures: { copyNumber, copyPin },
        },
      });

      addCardToResourceCache(getUserAccountHolderId(request), newCard.id);
      return reply.status(201).send(newCard);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // Order a physical card with address validation
  typedApp.post("/api/cards/:id/order-physical", {
    schema: {
      tags: ["Cards"],
      description: "Order a physical card with address validation",
      params: IdParamsSchema,
      body: OrderPhysicalCardBodySchema,
    },
  }, async (request, reply) => {
    try {
      const { cardIds } = await getUserResourceIds(request);
      if (!cardIds.has(request.params.id)) {
        return reply.status(403).send({ error: "Card does not belong to this user" });
      }

      const {
        nameOnCard, recipientGivenName, recipientFamilyName,
        streetAddress, extendedAddress, locality, region, postalCode, countryCodeAlpha3,
      } = request.body;

      // Step 1: Validate address
      const validation = await highnote.addresses.validate({
        address: { streetAddress, extendedAddress, locality, region, postalCode, countryCodeAlpha3 },
        idempotencyKey: randomUUID(),
      });

      const outcome = validation.outcome;
      if (!outcome) {
        return reply.status(400).send({ error: "Address validation returned no outcome" });
      }

      if (outcome.__typename === "AddressIncompleteResult") {
        return reply.status(400).send({ error: "Address is incomplete", validationOutcome: outcome.__typename });
      }
      if (outcome.__typename === "AddressInvalidResult") {
        return reply.status(400).send({ error: "Address is invalid", validationOutcome: outcome.__typename });
      }

      const token = (outcome as any).token;
      if (!token?.id) {
        return reply.status(500).send({ error: "Address validated but no token returned" });
      }

      // Step 2: Order with validated address
      const order = await highnote.cards.orderPhysicalWithValidatedAddress({
        paymentCardId: request.params.id,
        cardPersonalization: { textLines: { line1: nameOnCard } },
        deliveryDetails: {
          validatedAddressId: token.id,
          name: { givenName: recipientGivenName, familyName: recipientFamilyName },
        },
        idempotencyKey: randomUUID(),
      });

      return reply.status(201).send({
        order,
        addressValidation: {
          outcome: outcome.__typename,
          standardizedAddress: token.standardized,
          ...(outcome.__typename === "AddressValidatedWithChangesResult" && {
            componentsChanged: (outcome as any).componentsChanged,
          }),
        },
      });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // Get card details
  typedApp.get("/api/cards/:id", {
    schema: {
      tags: ["Cards"],
      description: "Get payment card details by Highnote ID",
      params: IdParamsSchema,
    },
  }, async (request, reply) => {
    try {
      const { cardIds } = await getUserResourceIds(request);
      if (!cardIds.has(request.params.id)) {
        return reply.status(403).send({ error: "Card does not belong to this user" });
      }
      const card = await highnote.cards.get(request.params.id);
      return card;
    } catch (err) {
      return handleError(err, reply);
    }
  });
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

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { highnote, cardProductId } from "../services/highnote.js";
import { HighnoteUserError, HighnoteAccessDeniedError, DocumentUploadClientTokenPermission } from "@highnote-oss/nodejs-sdk";
import { CreateApplicationBodySchema, DocumentTokenBodySchema, IdParamsSchema } from "../types.js";
import { getUserAccountHolderId } from "../middleware/auth.js";

export async function applicationRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Create application for a card product
  typedApp.post("/api/applications", {
    schema: {
      tags: ["Applications"],
      description: "Create a card product application for the logged-in user",
      body: CreateApplicationBodySchema,
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

      const application = await highnote.applications.create({
        accountHolderId: accountHolderHnId,
        cardProductId: productId,
        cardHolderAgreementConsent: {
          consentTimestamp: new Date().toISOString(),
          primaryAuthorizedPersonId: accountHolderHnId,
        },
      });

      return reply.status(201).send(application);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // Get application status
  typedApp.get("/api/applications/:id", {
    schema: {
      tags: ["Applications"],
      description: "Get application status by Highnote ID",
      params: IdParamsSchema,
    },
  }, async (request, reply) => {
    try {
      const ahId = getUserAccountHolderId(request);
      const application = await highnote.applications.get(request.params.id);

      // Verify the application belongs to this user's account holder
      const snapshot = application.accountHolderSnapshot;
      const snapshotAhId =
        snapshot?.__typename === "USPersonAccountHolderSnapshot"
          ? snapshot.accountHolderCurrent?.id
          : undefined;
      if (snapshotAhId !== ahId) {
        return reply.status(403).send({ error: "Application does not belong to this user" });
      }

      return application;
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // Start a document upload session for an application
  typedApp.post("/api/applications/:id/document-session", {
    schema: {
      tags: ["Applications"],
      description: "Start a document upload session for a pending application",
      params: IdParamsSchema,
    },
  }, async (request, reply) => {
    try {
      const ahId = getUserAccountHolderId(request);
      const application = await highnote.applications.get(request.params.id);

      // Verify the application belongs to this user
      const snapshot = application.accountHolderSnapshot;
      const snapshotAhId =
        snapshot?.__typename === "USPersonAccountHolderSnapshot"
          ? snapshot.accountHolderCurrent?.id
          : undefined;
      if (snapshotAhId !== ahId) {
        return reply.status(403).send({ error: "Application does not belong to this user" });
      }

      // Find the document upload session ID from the application's verification
      const verification = (() => {
        const snapshot = application.accountHolderSnapshot;
        if (snapshot?.__typename === "USPersonAccountHolderSnapshot") {
          return snapshot.currentVerification;
        }
        return undefined;
      })();
      const requiredDoc = verification?.requiredDocuments?.find(
        (d) => d?.documentUploadSession,
      );
      const docSession = requiredDoc?.documentUploadSession;
      const sessionId =
        docSession && "__typename" in docSession &&
        docSession.__typename === "USAccountHolderApplicationDocumentUploadSession"
          ? docSession.id
          : undefined;

      if (!sessionId) {
        return reply.status(400).send({
          error: "No document upload session found for this application",
        });
      }

      try {
        const session = await highnote.documents.startSession({
          documentUploadSessionId: sessionId,
        });
        return session;
      } catch {
        // Session may already be started — return the session ID so the client can proceed
        return { id: sessionId, status: "STARTED" };
      }
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // Generate a client token for a document upload session
  typedApp.post("/api/applications/:id/document-token", {
    schema: {
      tags: ["Applications"],
      description: "Generate a scoped client token for the document upload SDK",
      params: IdParamsSchema,
      body: DocumentTokenBodySchema,
    },
  }, async (request, reply) => {
    try {
      const ahId = getUserAccountHolderId(request);
      const application = await highnote.applications.get(request.params.id);

      // Verify the application belongs to this user
      const snapshot = application.accountHolderSnapshot;
      const snapshotAhId =
        snapshot?.__typename === "USPersonAccountHolderSnapshot"
          ? snapshot.accountHolderCurrent?.id
          : undefined;
      if (snapshotAhId !== ahId) {
        return reply.status(403).send({ error: "Application does not belong to this user" });
      }

      // Derive the document upload session ID from the application data
      // instead of trusting the request body (prevents IDOR)
      const verification = (() => {
        const snap = application.accountHolderSnapshot;
        if (snap?.__typename === "USPersonAccountHolderSnapshot") {
          return snap.currentVerification;
        }
        return undefined;
      })();
      const requiredDoc = verification?.requiredDocuments?.find(
        (d) => d?.documentUploadSession,
      );
      const docSession = requiredDoc?.documentUploadSession;
      const sessionId =
        docSession && "__typename" in docSession &&
        docSession.__typename === "USAccountHolderApplicationDocumentUploadSession"
          ? docSession.id
          : undefined;

      if (!sessionId) {
        return reply.status(400).send({
          error: "No document upload session found for this application",
        });
      }

      const token = await highnote.clientTokens.createForDocumentUpload({
        documentUploadSessionId: sessionId,
        permissions: [DocumentUploadClientTokenPermission.MANAGE_DOCUMENT_UPLOAD_SESSION],
      });

      return token;
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

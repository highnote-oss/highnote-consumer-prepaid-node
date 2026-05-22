import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema, sqlite } from "../db/index.js";
import { highnote } from "../services/highnote.js";
import { verifyWebhookSignature } from "@highnote-oss/nodejs-sdk";
import * as webhookRegistration from "../services/webhookRegistration.js";
import { WebhookEventsQuerySchema, WebhookRegisterBodySchema } from "../types.js";

const DeliveryAttemptsQuerySchema = z.object({
  unsuccessfulOnly: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const ReplayParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function webhookRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/webhooks — Receive webhook events (public, no JWT)
  typedApp.post("/api/webhooks", {
    schema: {
      tags: ["Webhooks"],
      description: "Receive Highnote webhook events",
    },
  }, async (request, reply) => {
    const secret = webhookRegistration.getSecret();

    const rawBody = (request as { rawBody?: string }).rawBody;
    if (!rawBody) {
      return reply.status(400).send({ error: "Missing request body" });
    }

    if (secret) {
      const signature = request.headers["highnote-signature"] as string | undefined;
      if (!signature) {
        return reply.status(401).send({ error: "Missing highnote-signature header" });
      }

      const result = verifyWebhookSignature({
        payload: rawBody,
        signature,
        secret,
      });

      if (!result.valid) {
        return reply.status(401).send({ error: "Invalid webhook signature" });
      }

      webhookRegistration.noteVerifiedEventReceived();
    } else {
      request.log.warn("Webhook signing key not available — rejecting unverifiable event");
      return reply.status(503).send({ error: "Webhook signing key not available" });
    }

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return reply.status(400).send({ error: "Invalid JSON payload" });
    }

    const eventId = (event.id as string | undefined) ?? null;
    const eventType =
      (event.name as string) ??
      (event.type as string) ??
      ((event.data as Record<string, unknown>)?.type as string) ??
      "UNKNOWN";
    const isReplay = request.headers["highnote-replay"] !== undefined;

    if (eventId) {
      sqlite
        .prepare(
          "INSERT OR IGNORE INTO webhook_events (event_id, event_type, is_replay, payload) VALUES (?, ?, ?, ?)",
        )
        .run(eventId, eventType, isReplay ? 1 : 0, rawBody);
    } else {
      request.log.warn({ eventType }, "Event missing id; inserting without idempotency");
      db.insert(schema.webhookEvents)
        .values({ eventType, isReplay, payload: rawBody })
        .run();
    }

    request.log.info({ eventType, eventId, isReplay }, "Webhook event received");
    return reply.status(200).send({ received: true });
  });

  // GET /api/webhooks/events — List stored events (JWT-protected)
  typedApp.get("/api/webhooks/events", {
    schema: {
      tags: ["Webhooks"],
      description: "List received webhook events",
      querystring: WebhookEventsQuerySchema,
    },
  }, async (request, reply) => {
    const { limit, offset } = request.query;
    const events = db
      .select()
      .from(schema.webhookEvents)
      .orderBy(desc(schema.webhookEvents.id))
      .limit(limit)
      .offset(offset)
      .all();

    const countResult = sqlite
      .prepare("SELECT COUNT(*) as count FROM webhook_events")
      .get() as { count: number };

    return reply.send({
      events,
      total: countResult.count,
      limit,
      offset,
    });
  });

  // GET /api/webhooks/status — Registration status (JWT-protected)
  typedApp.get("/api/webhooks/status", {
    schema: {
      tags: ["Webhooks"],
      description: "Get current webhook registration status",
    },
  }, async (_request, reply) => {
    return reply.send(await webhookRegistration.getStatus());
  });

  // GET /api/webhooks/delivery-attempts — List Highnote's record of delivery attempts (JWT-protected)
  typedApp.get("/api/webhooks/delivery-attempts", {
    schema: {
      tags: ["Webhooks"],
      description:
        "List recent delivery attempts as recorded by Highnote for the current target. Distinct from /events, which lists events the receiver has persisted locally.",
      querystring: DeliveryAttemptsQuerySchema,
    },
  }, async (request, reply) => {
    const status = webhookRegistration.getStatusSync();
    if (!status.targetId) {
      return reply.send({ attempts: [], targetId: null });
    }

    const { unsuccessfulOnly, limit } = request.query;
    const attempts: Array<{
      eventId: string | null;
      eventName: string | null;
      createdAt: string | null;
      hasSuccessfulDelivery: boolean | null;
    }> = [];

    try {
      for await (const e of highnote.webhooks.listEvents(status.targetId, { unsuccessfulOnly })) {
        attempts.push({
          eventId: e.event?.id ?? null,
          eventName: e.event?.name ?? null,
          createdAt: e.event?.createdAt ?? null,
          hasSuccessfulDelivery: e.hasSuccessfulDelivery ?? null,
        });
        if (attempts.length >= limit) break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list delivery attempts";
      return reply.status(502).send({ error: message });
    }

    return reply.send({ attempts, targetId: status.targetId });
  });

  // POST /api/webhooks/events/:id/replay — Replay an event from our log via Highnote (JWT-protected)
  typedApp.post("/api/webhooks/events/:id/replay", {
    schema: {
      tags: ["Webhooks"],
      description:
        "Ask Highnote to replay a stored event to the current target. The event must have a Highnote event id (older events without one cannot be replayed).",
      params: ReplayParamsSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const row = db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.id, id))
      .get();

    if (!row) {
      return reply.status(404).send({ error: "Event not found" });
    }
    if (!row.eventId) {
      return reply.status(400).send({
        error: "This event has no Highnote event id and cannot be replayed",
      });
    }

    const status = webhookRegistration.getStatusSync();
    const targetIds = status.targetId ? [status.targetId] : undefined;

    try {
      await highnote.webhooks.replay({
        notificationEventId: row.eventId,
        targetIds,
      });
      return reply.send({ replayed: true, eventId: row.eventId, targetIds });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to replay event";
      return reply.status(502).send({ error: message });
    }
  });

  // POST /api/webhooks/register — Register webhook target (JWT-protected)
  // - Empty body: re-runs auto-registration (manual retry path).
  // - Body provided: legacy explicit-name path. Registers via SDK with the given subscriptions
  //   and stores the returned signing key in memory (overrides auto-registered key).
  typedApp.post("/api/webhooks/register", {
    schema: {
      tags: ["Webhooks"],
      description:
        "Re-register the webhook target. Send empty body to re-run auto-registration; send a body to register a custom-named target.",
      body: WebhookRegisterBodySchema.partial().optional(),
    },
  }, async (request, reply) => {
    const body = request.body as
      | { name?: string; subscriptions?: string[] }
      | undefined;

    if (!body || (!body.name && !body.subscriptions)) {
      await webhookRegistration.init();
      return reply.send(await webhookRegistration.getStatus());
    }

    if (!body.name || !body.subscriptions) {
      return reply.status(400).send({
        error: "Both name and subscriptions are required when providing a body",
      });
    }

    const webhookUrl = webhookRegistration.getPublicWebhookUrl();
    if (!webhookUrl) {
      return reply.status(400).send({ error: "No public webhook URL configured" });
    }

    try {
      const target = await highnote.webhooks.add({
        name: body.name,
        uri: webhookUrl,
        subscriptions: body.subscriptions as never[],
      });

      return reply.status(201).send({
        id: target.id,
        name: target.name,
        uri: target.uri,
        status: target.status,
        message:
          "Webhook registered. Note: signing key is not persisted by the server in this mode.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to register webhook";
      return reply.status(500).send({ error: message });
    }
  });
}

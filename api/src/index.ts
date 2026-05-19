import "dotenv/config";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyStatic from "@fastify/static";
import fastifyRawBody from "fastify-raw-body";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sqlite } from "./db/index.js";
import { registerAuthHook } from "./middleware/auth.js";
import { authRoutes, onboardRoute } from "./routes/auth.js";
import { cardProductRoutes } from "./routes/cardProducts.js";
import { meRoute } from "./routes/me.js";
import { applicationRoutes } from "./routes/applications.js";
import { financialAccountRoutes } from "./routes/financialAccounts.js";
import { cardRoutes } from "./routes/cards.js";
import { transactionRoutes } from "./routes/transactions.js";
import { clientTokenRoutes } from "./routes/clientTokens.js";
import { provisioningRoutes } from "./routes/provisioning.js";
import { simulateRoutes } from "./routes/simulate.js";
import { externalAccountRoutes } from "./routes/externalAccounts.js";
import { achTransferRoutes } from "./routes/ach.js";
import { atmRoutes } from "./routes/atm.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { environment } from "./services/highnote.js";
import * as webhookRegistration from "./services/webhookRegistration.js";

const app = Fastify({ logger: true });

// CORS — allow frontend dev server
await app.register(fastifyCors, { origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" });

// Raw body access for webhook signature verification
await app.register(fastifyRawBody, { field: "rawBody", encoding: "utf8", runFirst: true });

// Zod validation & serialization
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// OpenAPI spec generation
await app.register(fastifySwagger, {
  transform: jsonSchemaTransform,
  openapi: {
    info: {
      title: "Bay19 API",
      description: "Consumer prepaid debit card management API powered by the Highnote SDK",
      version: "1.0.0",
    },
    servers: [{ url: "http://localhost:3000" }],
    tags: [
      { name: "Auth", description: "User authentication, onboarding, and account holder creation" },
      { name: "Card Products", description: "Browse available card products" },
      { name: "Applications", description: "Card product applications" },
      { name: "Financial Accounts", description: "Issue and manage financial accounts" },
      { name: "Cards", description: "Issue and manage payment cards" },
      { name: "Transactions", description: "View transaction history" },
      { name: "Provisioning", description: "Provision account holders (application + financial account)" },
      { name: "Client Tokens", description: "Generate scoped client tokens" },
      { name: "Simulation", description: "Test environment simulation tools (test env only)" },
      { name: "Webhooks", description: "Webhook receiver, event viewer, and registration" },
    ],
  },
});

await app.register(fastifySwaggerUi, {
  routePrefix: "/docs",
});

// Run SQLite table creation on startup (Drizzle push equivalent)
function ensureTables() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      account_holder_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT UNIQUE,
      event_type TEXT NOT NULL,
      is_replay INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL,
      received_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// Health check
app.get("/health", async () => ({ status: "ok" }));

// Environment config (public)
app.get("/api/config", async () => ({ environment }));

// Public routes (no auth required) — register BEFORE the auth plugin
await app.register(authRoutes);
await app.register(cardProductRoutes);
await app.register(webhookRoutes);

// Auth middleware — global hook, skips public paths
registerAuthHook(app);

// Protected route modules
await app.register(onboardRoute);
await app.register(meRoute);
await app.register(applicationRoutes);
await app.register(financialAccountRoutes);
await app.register(cardRoutes);
await app.register(transactionRoutes);
await app.register(clientTokenRoutes);
await app.register(provisioningRoutes);
await app.register(externalAccountRoutes);
await app.register(achTransferRoutes);
await app.register(atmRoutes);

// Simulation routes — only registered in test environment
if (environment === "test") {
  await app.register(simulateRoutes);
}

// Serve frontend static files in production
if (process.env.NODE_ENV === "production") {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  await app.register(fastifyStatic, {
    root: join(__dirname, "..", "public"),
    prefix: "/",
    wildcard: false,
  });

  // SPA fallback — serve index.html for non-API routes
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });
}

// Start server
const port = parseInt(process.env.PORT ?? "3000", 10);

try {
  ensureTables();
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Bay19 API running on http://localhost:${port}`);

  // Fire-and-forget: webhook registration runs in the background after listen.
  // Errors are caught internally and surfaced via /api/webhooks/status.
  void webhookRegistration.init();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

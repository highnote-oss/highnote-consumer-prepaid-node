import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  accountHolderId: text("account_holder_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const webhookEvents = sqliteTable("webhook_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: text("event_id").unique(),
  eventType: text("event_type").notNull(),
  isReplay: integer("is_replay", { mode: "boolean" }).notNull().default(false),
  payload: text("payload").notNull(),
  receivedAt: text("received_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

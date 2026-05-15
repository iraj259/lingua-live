import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// These enums give us database-level validation — not just TypeScript types.
// Bad data can't enter the DB even if someone bypasses the API.
export const languageEnum = pgEnum("language", [
  "spanish", "french", "german", "italian",
  "japanese", "mandarin", "portuguese", "arabic",
]);

export const levelEnum = pgEnum("level", [
  "beginner", "intermediate", "advanced",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "active", "completed", "abandoned",
]);

export const messageRoleEnum = pgEnum("message_role", [
  "user", "assistant",
]);

// ── users ──────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName:  text("display_name").notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── sessions ───────────────────────────────────────────────────────────────
export const sessions = pgTable("sessions", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  language:        languageEnum("language").notNull(),
  level:           levelEnum("level").notNull(),
  status:          sessionStatusEnum("status").notNull().default("active"),
  scenarioContext: jsonb("scenario_context"),
  title:           text("title"),
  startedAt:       timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt:         timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
});

// ── messages ───────────────────────────────────────────────────────────────
export const messages = pgTable("messages", {
  id:        uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  role:      messageRoleEnum("role").notNull(),
  content:   text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── relations (enables Drizzle join queries) ───────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user:     one(users, { fields: [sessions.userId], references: [users.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, { fields: [messages.sessionId], references: [sessions.id] }),
}));

// ── inferred types — use these everywhere instead of raw row types ─────────
export type User       = typeof users.$inferSelect;
export type NewUser    = typeof users.$inferInsert;
export type Session    = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message    = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type Language      = (typeof languageEnum.enumValues)[number];
export type Level         = (typeof levelEnum.enumValues)[number];
export type SessionStatus = (typeof sessionStatusEnum.enumValues)[number];
export type MessageRole   = (typeof messageRoleEnum.enumValues)[number];
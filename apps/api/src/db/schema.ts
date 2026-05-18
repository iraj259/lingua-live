import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  real,
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

// ── feedback_reports ───────────────────────────────────────────────────────
export const feedbackReports = pgTable("feedback_reports", {
  id:           uuid("id").primaryKey().defaultRandom(),
  sessionId:    uuid("session_id")
                  .notNull()
                  .unique()
                  .references(() => sessions.id, { onDelete: "cascade" }),
  grammarScore: real("grammar_score").notNull(),
  fluencyScore: real("fluency_score").notNull(),
  vocabScore:   real("vocab_score").notNull(),
  corrections:  jsonb("corrections").notNull().default([]),
  suggestions:  jsonb("suggestions").notNull().default([]),
  strengths:    jsonb("strengths").notNull().default([]),
  weaknessTags: jsonb("weakness_tags").notNull().default([]),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── user_memory ────────────────────────────────────────────────────────────
export const userMemory = pgTable("user_memory", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          uuid("user_id")
                     .notNull()
                     .references(() => users.id, { onDelete: "cascade" }),
  language:        text("language").notNull(),
  weaknessTags:    jsonb("weakness_tags").notNull().default({}),
  totalSessions:   integer("total_sessions").notNull().default(0),
  avgGrammarScore: real("avg_grammar_score").notNull().default(0),
  avgFluencyScore: real("avg_fluency_score").notNull().default(0),
  avgVocabScore:   real("avg_vocab_score").notNull().default(0),
  lastSessionAt:   timestamp("last_session_at", { withTimezone: true }),
},
(table) => ({
  userLanguageUnique: {
    name:    "user_memory_user_id_language_unique",
    columns: [table.userId, table.language],
  },
}));

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

export const feedbackReportsRelations = relations(feedbackReports, ({ one }) => ({
  session: one(sessions, {
    fields:     [feedbackReports.sessionId],
    references: [sessions.id],
  }),
}));

export const userMemoryRelations = relations(userMemory, ({ one }) => ({
  user: one(users, {
    fields:     [userMemory.userId],
    references: [users.id],
  }),
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

export type FeedbackReport    = typeof feedbackReports.$inferSelect;
export type NewFeedbackReport = typeof feedbackReports.$inferInsert;
export type UserMemory        = typeof userMemory.$inferSelect;
export type NewUserMemory     = typeof userMemory.$inferInsert;
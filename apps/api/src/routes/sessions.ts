import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, count } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, messages } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { NotFoundError, ForbiddenError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const sessionsRouter = new Hono();
sessionsRouter.use("*", authMiddleware);

const createSessionSchema = z.object({
  language: z.enum(["spanish","french","german","italian","japanese","mandarin","portuguese","arabic"]),
  level:    z.enum(["beginner","intermediate","advanced"]),
});

const endSessionSchema = z.object({
  title: z.string().max(100).optional(),
});

// ── POST /sessions ─────────────────────────────────────────────────────────
sessionsRouter.post(
  "/",
  zValidator("json", createSessionSchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid session parameters" }, 422);
    return undefined;
  }),
  async (c) => {
    const userId = c.get("userId");
    const { language, level } = c.req.valid("json");

    const [session] = await db.insert(sessions)
      .values({ userId, language, level, status: "active" })
      .returning();

    if (!session) throw new Error("Failed to create session");
    logger.info("Session created", { sessionId: session.id, userId, language, level });
    return c.json({ session }, 201);
  }
);

// ── GET /sessions ──────────────────────────────────────────────────────────
sessionsRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const limit  = Math.min(parseInt(c.req.query("limit")  ?? "20"), 50);
  const offset =           parseInt(c.req.query("offset") ?? "0");

  const rows = await db.select({
    id: sessions.id, language: sessions.language, level: sessions.level,
    status: sessions.status, title: sessions.title,
    startedAt: sessions.startedAt, endedAt: sessions.endedAt,
    durationSeconds: sessions.durationSeconds,
  })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.startedAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db.select({ total: count() })
    .from(sessions).where(eq(sessions.userId, userId));
  const total = countResult[0]?.total ?? 0;

  return c.json({
    sessions: rows,
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  });
});

// ── GET /sessions/:id ──────────────────────────────────────────────────────
sessionsRouter.get("/:id", async (c) => {
  const userId    = c.get("userId");
  const sessionId = c.req.param("id");

  const [session] = await db.select().from(sessions)
    .where(eq(sessions.id, sessionId)).limit(1);

  if (!session) throw new NotFoundError("Session");
  if (session.userId !== userId) throw new ForbiddenError();

  const msgs = await db.select().from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt);

  return c.json({ session, messages: msgs });
});

// ── PATCH /sessions/:id/end ────────────────────────────────────────────────
sessionsRouter.patch(
  "/:id/end",
  zValidator("json", endSessionSchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid request" }, 422);
    return undefined;
  }),
  async (c) => {
    const userId    = c.get("userId");
    const sessionId = c.req.param("id");
    const { title } = c.req.valid("json");

    const [session] = await db.select().from(sessions)
      .where(eq(sessions.id, sessionId)).limit(1);

    if (!session) throw new NotFoundError("Session");
    if (session.userId !== userId) throw new ForbiddenError();
    if (session.status === "completed") return c.json({ session });

    const endedAt = new Date();
    const durationSeconds = Math.floor(
      (endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000
    );

    const [updated] = await db.update(sessions)
      .set({ status: "completed", endedAt, durationSeconds, title: title ?? null })
      .where(eq(sessions.id, sessionId))
      .returning();

    logger.info("Session ended", { sessionId, durationSeconds });
    return c.json({ session: updated });
  }
);
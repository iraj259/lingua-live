import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { feedbackReports, sessions, userMemory } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { memoryService } from "../services/memory.service.js";

export const feedbackRouter = new Hono();

// GET /feedback/:sessionId — fetch feedback report for a session
feedbackRouter.get("/:sessionId", authMiddleware, async (c) => {
  const userId    = c.get("userId") as string;
  const sessionId = c.req.param("sessionId");

  const [session] = await db
    .select({ id: sessions.id, userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
  if (session.userId !== userId) throw new AppError("Forbidden", 403, "FORBIDDEN");

  const [report] = await db
    .select()
    .from(feedbackReports)
    .where(eq(feedbackReports.sessionId, sessionId))
    .limit(1);

  if (!report) {
    return c.json({ pending: true });
  }

  return c.json({ pending: false, report });
});

// GET /feedback/memory/:language — fetch user memory for a language
feedbackRouter.get("/memory/:language", authMiddleware, async (c) => {
  const userId   = c.get("userId") as string;
  const language = c.req.param("language");

  const memory = await memoryService.load(userId, language);
  const topWeaknesses = memoryService.getTopWeaknesses(memory);

  return c.json({ memory, topWeaknesses });
});

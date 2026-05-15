import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, messages } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { generateResponse, buildSystemPrompt, type ChatMessage } from "../lib/groq.js";
import { NotFoundError, ForbiddenError, AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const chatRouter = new Hono();
chatRouter.use("*", authMiddleware);

const chatSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  message:   z.string().min(1).max(2000).trim(),
});

chatRouter.post(
  "/",
  zValidator("json", chatSchema, (result, c) => {
    if (!result.success) {
      return c.json({
        error: "Invalid request",
        code: "VALIDATION_ERROR",
        issues: result.error.issues.map(i => ({ field: i.path.join("."), message: i.message })),
      }, 422);
    }
    return undefined;
  }),
  async (c) => {
    const userId = c.get("userId");
    const { sessionId, message } = c.req.valid("json");

    // 1. Verify session exists and belongs to this user
    const [session] = await db.select().from(sessions)
      .where(eq(sessions.id, sessionId)).limit(1);

    if (!session) throw new NotFoundError("Session");
    if (session.userId !== userId) throw new ForbiddenError();
    if (session.status !== "active") {
      throw new AppError(
        "This session has ended. Start a new session to continue.",
        400, "SESSION_ENDED"
      );
    }

    // 2. Load conversation history (last 20 messages)
    // 20 messages × ~150 tokens avg = ~3,000 tokens context.
    // Well within Groq's limit. Adjust if needed.
    const history = await db.select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt))
      .limit(20);

    // 3. Build the full message array for Groq
    const groqMessages: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt(session.language, session.level) },
      ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: message },
    ];

    logger.info("Sending to Groq", {
      sessionId, language: session.language,
      level: session.level, messageCount: groqMessages.length,
    });

    // 4. Call Groq
    const aiResponse = await generateResponse(groqMessages, {
      temperature: 0.75,
      maxTokens: 500,
    });

    // 5. Save user message first, then AI message (order matters for history)
    const [savedUserMessage] = await db.insert(messages)
      .values({ sessionId, role: "user", content: message })
      .returning();

    const [savedAiMessage] = await db.insert(messages)
      .values({ sessionId, role: "assistant", content: aiResponse })
      .returning();

    // 6. Set session title from first user message
    if (history.length === 0 && session.title === null) {
      const title = message.length > 60 ? message.slice(0, 57) + "..." : message;
      await db.update(sessions).set({ title }).where(eq(sessions.id, sessionId));
    }

    return c.json({ userMessage: savedUserMessage, aiMessage: savedAiMessage });
  }
);
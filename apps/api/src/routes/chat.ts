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

// ── Suggest replies ────────────────────────────────────────────────────────
const suggestSchema = z.object({
  aiMessage: z.string().min(1).max(2000),
  language:  z.string(),
  level:     z.string(),
});

chatRouter.post(
  "/suggest",
  zValidator("json", suggestSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid request", code: "VALIDATION_ERROR" }, 422);
    }
    return undefined;
  }),
  async (c) => {
    const { aiMessage, language, level } = c.req.valid("json");

    const raw = await generateResponse([
      {
        role: "system",
        content: `You are helping a ${level} ${language} learner practice conversation.
Given the tutor's message, suggest 3 short, natural replies the learner could say.
Return ONLY a JSON array with exactly 3 objects, no markdown, no extra text:
[{"reply":"<reply in ${language}>","english":"<brief English meaning, max 8 words>"}]
Replies must be appropriate for a ${level} learner — keep them short and realistic.`,
      },
      { role: "user", content: aiMessage },
    ], {
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      maxTokens: 300,
    });

    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      return c.json({ suggestions });
    } catch {
      return c.json({ suggestions: [] });
    }
  }
);

// ── Translate a message to English ────────────────────────────────────────
const translateSchema = z.object({
  text:         z.string().min(1).max(2000),
  fromLanguage: z.string(),
});

chatRouter.post(
  "/translate",
  zValidator("json", translateSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid request", code: "VALIDATION_ERROR" }, 422);
    }
    return undefined;
  }),
  async (c) => {
    const { text, fromLanguage } = c.req.valid("json");

    const translation = await generateResponse([
      {
        role: "system",
        content: `You are a translator. Translate the following ${fromLanguage} text to English.
Return ONLY the English translation — no explanations, no original text, no quotes.`,
      },
      { role: "user", content: text },
    ], {
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      maxTokens: 300,
    });

    return c.json({ translation: translation.trim() });
  }
);
/**
 * WSSession — manages one active WebSocket conversation.
 *
 * Created by the WebSocket upgrade handler and stored in a Map
 * keyed by sessionId. Destroyed when the session ends or the
 * connection closes.
 *
 * Responsibilities:
 * - Handle start_session: generate scenario, send session_ready
 * - Handle send_message: stream AI response token by token
 * - Handle end_session: mark session complete in DB
 * - Handle ping: respond with pong
 * - Clean up on disconnect
 */

import { and, eq, asc, gte } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, messages } from "../db/schema.js";
import { generateResponse, MODELS } from "./groq.js";
import { ScenarioAgent } from "../agents/scenario.agent.js";
import { logger } from "./logger.js";
import { type ScenarioContext, type ServerMessage } from "./ws-types.js";

// ── Groq streaming ─────────────────────────────────────────────────────────
// This is a separate streaming fetch — Phase 2 adds this alongside the
// existing generateResponse function. We don't replace it.
async function* streamGroqResponse(
  messages_: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  model = MODELS.MAIN
): AsyncGenerator<string> {
  const GROQ_API_KEY = process.env["GROQ_API_KEY"];
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: messages_,
      temperature:  0.75,
      max_tokens:   500,
      stream:       true,   // ← the key difference from Phase 1
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "unknown");
    throw new Error(`Groq stream error ${res.status}: ${err}`);
  }

  // Parse the SSE stream
  // Groq sends: "data: {...}\n\n" lines, ending with "data: [DONE]\n\n"
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process all complete lines in the buffer
    const lines = buffer.split("\n");
    // Keep the last (possibly incomplete) line in the buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data) as {
          choices: Array<{ delta: { content?: string }; finish_reason: string | null }>;
        };
        const token = parsed.choices[0]?.delta.content;
        if (token) yield token;
      } catch {
        // Malformed SSE line — skip silently
      }
    }
  }
}

// ── WSSession class ────────────────────────────────────────────────────────
export class WSSession {
  private scenarioAgent    = new ScenarioAgent();
  private scenario:          ScenarioContext | null = null;
  private sessionDbId:       string | null = null;
  private sessionStartedAt:  Date | null = null;  // marks the start of THIS connection
  private language:          string = "spanish";
  private level:             string = "beginner";
  private isEnded:           boolean = false;

  constructor(private readonly sendRaw: (msg: ServerMessage) => void) {}

  // ── Public message handler ───────────────────────────────────────────────
  // Called by the WebSocket server for every incoming message from this client
  async handleMessage(data: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      this.sendError("PARSE_ERROR", "Invalid message format — must be JSON");
      return;
    }

    const msg = parsed as { type: string; [key: string]: unknown };

    switch (msg.type) {
      case "start_session":
        await this.handleStartSession(
          msg.sessionId    as string,
          msg.language     as string,
          msg.level        as string,
          msg.scenarioRequest as string
        );
        break;
      case "send_message":
        await this.handleSendMessage(msg.content as string);
        break;
      case "end_session":
        await this.handleEndSession();
        break;
      case "ping":
        this.sendRaw({ type: "pong" });
        break;
      default:
        this.sendError("UNKNOWN_MESSAGE", `Unknown message type: ${String(msg.type)}`);
    }
  }

  // ── start_session ────────────────────────────────────────────────────────
  private async handleStartSession(
    sessionId: string,
    language: string,
    level: string,
    scenarioRequest: string
  ): Promise<void> {
    if (this.sessionDbId) {
      this.sendError("ALREADY_STARTED", "Session already started");
      return;
    }

    // Verify session exists in DB
    const [session] = await db.select().from(sessions)
      .where(eq(sessions.id, sessionId)).limit(1);

    if (!session) {
      this.sendError("SESSION_NOT_FOUND", "Session not found");
      return;
    }

    this.sessionDbId      = sessionId;
    this.language         = language;
    this.level            = level;
    this.sessionStartedAt = new Date();

    logger.info("WS session starting", { sessionId, language, level });

    // Generate the scenario persona
    const scenario = await this.scenarioAgent.generate(scenarioRequest, language, level);
    this.scenario  = scenario;

    // Save scenario context (non-fatal — session works even if column is missing)
    await db.update(sessions)
      .set({ scenarioContext: scenario as any })
      .where(eq(sessions.id, sessionId))
      .catch((err: unknown) => logger.warn("Failed to save scenario_context — run db:push", { err }));

    // Tell the client the session is ready — triggers persona display in UI
    this.sendRaw({ type: "session_ready", scenario });

    // Send the opening message — but don't save if the session already has messages
    // (reconnect case: avoid stacking duplicate greetings in DB and context)
    const existing = await db.select({ id: messages.id })
      .from(messages).where(eq(messages.sessionId, sessionId)).limit(1);

    if (existing.length === 0) {
      await this.saveAndSendAiMessage(scenario.openingMessage);
    } else {
      this.sendRaw({
        type:    "message_done",
        message: { id: `opening-${Date.now()}`, role: "assistant", content: scenario.openingMessage, createdAt: new Date().toISOString() },
      });
    }
  }

  // ── send_message ─────────────────────────────────────────────────────────
  private async handleSendMessage(content: string): Promise<void> {
    if (!this.sessionDbId || !this.scenario) {
      this.sendError("NOT_STARTED", "Session not started");
      return;
    }
    if (this.isEnded) {
      this.sendError("SESSION_ENDED", "Session has already ended");
      return;
    }
    if (!content?.trim()) {
      this.sendError("EMPTY_MESSAGE", "Message cannot be empty");
      return;
    }

    const text = content.trim();

    // 1. Save user message to DB
    const [savedUserMsg] = await db.insert(messages)
      .values({ sessionId: this.sessionDbId, role: "user", content: text })
      .returning();

    if (!savedUserMsg) throw new Error("Failed to save user message");

    // 2. Tell client the user message was saved (gives it the DB id)
    this.sendRaw({
      type:    "user_message_saved",
      message: {
        id:        savedUserMsg.id,
        role:      "user",
        content:   savedUserMsg.content,
        createdAt: savedUserMsg.createdAt.toISOString(),
      },
    });

    // 3. Load only messages from this connection's start — prevents old
    //    personas from leaking into the context when a session is reused.
    const historyWhere = this.sessionStartedAt
      ? and(eq(messages.sessionId, this.sessionDbId), gte(messages.createdAt, this.sessionStartedAt))
      : eq(messages.sessionId, this.sessionDbId);

    const history = await db.select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(historyWhere)
      .orderBy(asc(messages.createdAt))
      .limit(20);

    // 4. Build message array for Groq
    const groqMessages = [
      { role: "system" as const, content: this.scenario.systemPrompt },
      ...history.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // 5. Stream the AI response token by token
    let fullResponse = "";
    try {
      for await (const token of streamGroqResponse(groqMessages)) {
        fullResponse += token;
        // Send each token to the client immediately
        this.sendRaw({ type: "token", token });
      }
    } catch (err) {
      logger.error("Groq stream error", err);
      this.sendError("AI_ERROR", "AI service temporarily unavailable. Please try again.");
      return;
    }

    if (!fullResponse.trim()) {
      this.sendError("EMPTY_RESPONSE", "AI returned an empty response. Please try again.");
      return;
    }

    // 6. Save the complete AI response to DB
    await this.saveAndSendAiMessage(fullResponse);

    // 7. Auto-set session title from first user message
    const [currentSession] = await db.select({ title: sessions.title })
      .from(sessions).where(eq(sessions.id, this.sessionDbId)).limit(1);

    if (!currentSession?.title) {
      const title = text.length > 60 ? text.slice(0, 57) + "..." : text;
      await db.update(sessions).set({ title }).where(eq(sessions.id, this.sessionDbId));
    }
  }

  // ── end_session ──────────────────────────────────────────────────────────
  private async handleEndSession(): Promise<void> {
    if (!this.sessionDbId || this.isEnded) return;
    this.isEnded = true;

    const [session] = await db.select({ startedAt: sessions.startedAt })
      .from(sessions).where(eq(sessions.id, this.sessionDbId)).limit(1);

    const endedAt = new Date();
    const durationSeconds = session
      ? Math.floor((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000)
      : 0;

    await db.update(sessions)
      .set({ status: "completed", endedAt, durationSeconds })
      .where(eq(sessions.id, this.sessionDbId));

    logger.info("WS session ended", { sessionId: this.sessionDbId, durationSeconds });
    this.sendRaw({ type: "session_ended" });
  }

  // ── Called when the WebSocket connection closes (tab close, network drop) ─
  async onDisconnect(): Promise<void> {
    if (!this.sessionDbId || this.isEnded) return;
    // Mark as abandoned if the user disconnects without ending properly
    await db.update(sessions)
      .set({ status: "abandoned", endedAt: new Date() })
      .where(eq(sessions.id, this.sessionDbId));
    logger.info("WS session abandoned on disconnect", { sessionId: this.sessionDbId });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private async saveAndSendAiMessage(content: string): Promise<void> {
    if (!this.sessionDbId) return;

    const [saved] = await db.insert(messages)
      .values({ sessionId: this.sessionDbId, role: "assistant", content })
      .returning();

    if (!saved) return;

    // message_done tells the client the stream is complete and the message is saved
    this.sendRaw({
      type:    "message_done",
      message: {
        id:        saved.id,
        role:      "assistant",
        content:   saved.content,
        createdAt: saved.createdAt.toISOString(),
      },
    });
  }

  private sendError(code: string, message: string): void {
    this.sendRaw({ type: "error", code, message });
  }
}
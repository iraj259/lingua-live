import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { authRouter }     from "./routes/auth.js";
import { sessionsRouter } from "./routes/sessions.js";
import { chatRouter }     from "./routes/chat.js";
import { feedbackRouter } from "./routes/feedback.js";
import { AppError }       from "./lib/errors.js";
import { logger }         from "./lib/logger.js";
import { WSSession } from "./lib/ws-session.js";
import { verifyToken } from "./middleware/auth.js";
import { db } from "./db/client.js";
import { sessions } from "./db/schema.js";
import { eq } from "drizzle-orm";
const app = new Hono();

app.use("*", secureHeaders());

app.use("*", cors({
  origin: (origin) => {
    const allowed = [
      process.env["FRONTEND_URL"] ?? "http://localhost:3000",
      "http://localhost:3000",
    ];
    if (!origin || allowed.includes(origin)) return origin ?? "*";
    return null;
  },
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use("*", honoLogger());

// Routes
app.route("/auth",     authRouter);
app.route("/sessions", sessionsRouter);
app.route("/chat",     chatRouter);
app.route("/feedback", feedbackRouter);

// Health check — Railway pings this to verify the service is alive
app.get("/health", (c) =>
  c.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() })
);

app.notFound((c) =>
  c.json({ error: `Route ${c.req.method} ${c.req.path} not found`, code: "NOT_FOUND" }, 404)
);

// Global error handler — catches all throws from route handlers
app.onError((err, c) => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`[${err.code}] ${err.message}`, { path: c.req.path });
    } else {
      logger.warn(`[${err.code}] ${err.message}`, { path: c.req.path });
    }
    return c.json({ error: err.message, code: err.code }, err.statusCode as any);
  }

  logger.error("Unhandled error", { message: err.message, stack: err.stack, path: c.req.path });
  return c.json({ error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" }, 500);
});

// ── Active WebSocket sessions ──────────────────────────────────────────────
// Map from connectionId → { wsSession, sendFn }
// We build this in the websocket.open handler where we have access to ws
type ActiveWS = {
  wsSession: WSSession;
};
const activeWS = new Map<string, ActiveWS>();

const PORT = parseInt(process.env["PORT"] ?? "3001");

type WSData = { connectionId: string; userId: string; sessionId: string };

Bun.serve<WSData>({
  port: PORT,

  websocket: {
    open(ws) {
      const { connectionId, userId } = ws.data;
      const wsSession = new WSSession((msg) => {
        ws.send(JSON.stringify(msg));
      }, userId);
      activeWS.set(connectionId, { wsSession });
      logger.info("WebSocket opened", { connectionId });
    },

    async message(ws, data) {
      const { connectionId } = ws.data;
      const entry = activeWS.get(connectionId);
      if (!entry) {
        ws.send(JSON.stringify({ type: "error", code: "NO_SESSION", message: "Not initialized" }));
        return;
      }
      try {
        await entry.wsSession.handleMessage(
          typeof data === "string" ? data : data.toString()
        );
      } catch (err) {
        logger.error("Unhandled WS message error", err);
        ws.send(JSON.stringify({ type: "error", code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." }));
      }
    },

    async close(ws) {
      const { connectionId } = ws.data;
      const entry = activeWS.get(connectionId);
      if (entry) {
        await entry.wsSession.onDisconnect();
        activeWS.delete(connectionId);
      }
      logger.info("WebSocket closed", { connectionId });
    },
  },

  async fetch(req: Request, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const token     = url.searchParams.get("token");
      const sessionId = url.searchParams.get("sessionId");

      if (!token || !sessionId) {
        return new Response(
          JSON.stringify({ error: "token and sessionId required" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      let userId: string;
      try {
        userId = await verifyToken(token);
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      const [session] = await db
        .select({ id: sessions.id, userId: sessions.userId })
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1);

      if (!session || session.userId !== userId) {
        return new Response(
          JSON.stringify({ error: "Session not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      const connectionId = `${sessionId}:${Date.now()}`;

      const upgraded = server.upgrade(req, {
        data: { connectionId, userId, sessionId },
      });

      if (!upgraded) return new Response("Upgrade failed", { status: 500 });
      return undefined as unknown as Response;
    }

    return app.fetch(req);
  },
});

logger.info(`API running on http://localhost:${PORT}`);
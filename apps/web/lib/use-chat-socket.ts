"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Language, Level } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
export interface ScenarioContext {
  personaName:    string;
  personaRole:    string;
  setting:        string;
  systemPrompt:   string;
  openingMessage: string;
}

export interface ChatMessage {
  id:        string;
  role:      "user" | "assistant";
  content:   string;
  createdAt: string;
}

type ConnectionState = "connecting" | "ready" | "ended" | "error" | "reconnecting";

interface UseChatSocketReturn {
  connectionState:  ConnectionState;
  scenario:         ScenarioContext | null;
  messages:         ChatMessage[];
  streamingContent: string;
  error:            string | null;
  sendMessage:      (content: string) => void;
  endSession:       () => void;
}

const WS_BASE = (process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001")
  .replace(/^http/, "ws");

export function useChatSocket(
  sessionId: string,
  language: Language,
  level: Level,
  scenarioRequest: string
): UseChatSocketReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [scenario, setScenario]               = useState<ScenarioContext | null>(null);
  const [messages, setMessages]               = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError]                     = useState<string | null>(null);

  const wsRef               = useRef<WebSocket | null>(null);
  const reconnectAttempts   = useRef(0);
  const maxReconnects       = 5;
  // Tracks closes that we initiated (cleanup / intentional end).
  // When true, onclose does nothing — prevents state from being
  // clobbered after React StrictMode double-invokes the effect.
  const closedIntentionally = useRef(false);

  // ── connect ──────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    closedIntentionally.current = false; // reset at the start of every attempt

    const token = localStorage.getItem("token");
    if (!token) {
      setConnectionState("error");
      setError("Not authenticated. Please log in again.");
      return;
    }

    const url = `${WS_BASE}/ws?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;
      setConnectionState("connecting"); // stays "connecting" until session_ready
      // Always send start_session on every new connection — this covers both
      // the first connect and reconnects after a drop.
      ws.send(JSON.stringify({
        type: "start_session",
        sessionId,
        language,
        level,
        scenarioRequest,
      }));
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      let msg: { type: string; [key: string]: unknown };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "session_ready": {
          setScenario(msg.scenario as ScenarioContext);
          setConnectionState("ready");
          break;
        }

        case "user_message_saved": {
          // Replace the last pending optimistic message with the server-confirmed one
          const m = msg.message as ChatMessage;
          setMessages(prev => {
            const pendingIdx = prev.reduceRight(
              (found, x, i) => found === -1 && x.id.startsWith("pending-") ? i : found,
              -1
            );
            if (pendingIdx === -1) return [...prev, m];
            return [...prev.slice(0, pendingIdx), m, ...prev.slice(pendingIdx + 1)];
          });
          break;
        }

        case "token": {
          setStreamingContent(prev => prev + (msg.token as string));
          break;
        }

        case "message_done": {
          const m = msg.message as ChatMessage;
          setMessages(prev => [...prev, m]);
          setStreamingContent("");
          break;
        }

        case "session_ended": {
          setConnectionState("ended");
          ws.close();
          break;
        }

        case "error": {
          setError((msg.message as string) ?? "An error occurred");
          break;
        }

        case "pong":
          break;
      }
    };

    ws.onclose = () => {
      wsRef.current = null;

      // Intentional close (cleanup / session end) — leave state as-is.
      if (closedIntentionally.current) return;

      if (reconnectAttempts.current < maxReconnects) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30_000);
        reconnectAttempts.current++;
        setConnectionState("reconnecting");
        setError(`Connection lost. Reconnecting in ${Math.round(delay / 1000)}s…`);
        setTimeout(() => {
          setError(null);
          connect();
        }, delay);
      } else {
        setConnectionState("error");
        setError("Connection lost. Please refresh the page to continue.");
      }
    };

    ws.onerror = () => {
      setError("WebSocket error occurred");
    };
  }, [sessionId, language, level, scenarioRequest]);

  // ── mount / unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    connect();
    return () => {
      // Mark as intentional so onclose doesn't set error state or reconnect
      closedIntentionally.current = true;
      wsRef.current?.close();
    };
  }, [connect]);

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 25_000);
    return () => clearInterval(interval);
  }, []);

  // ── sendMessage ───────────────────────────────────────────────────────────
  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setError("Not connected. Please wait…");
      return;
    }
    if (connectionState !== "ready") {
      setError("Session not ready yet. Please wait.");
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) return;

    // Optimistic: show immediately, swapped for server-confirmed on user_message_saved
    setMessages(prev => [
      ...prev,
      { id: `pending-${Date.now()}`, role: "user" as const, content: trimmed, createdAt: new Date().toISOString() },
    ]);
    wsRef.current.send(JSON.stringify({ type: "send_message", content: trimmed }));
  }, [connectionState]);

  // ── endSession ────────────────────────────────────────────────────────────
  const endSession = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end_session" }));
    }
  }, []);

  return {
    connectionState,
    scenario,
    messages,
    streamingContent,
    error,
    sendMessage,
    endSession,
  };
}

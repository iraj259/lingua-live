"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Language, Level } from "@/lib/api";

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

type ConnectionState =
  | "connecting"
  | "ready"
  | "ended"
  | "error"
  | "reconnecting";

interface UseChatSocketOptions {
  sessionId:       string;
  language:        Language;
  level:           Level;
  scenarioRequest: string;
  // Called when STT result arrives — lets the session page
  // show what was heard in the transcript
  onSTTResult?: (transcript: string) => void;
}

interface UseChatSocketReturn {
  connectionState:  ConnectionState;
  scenario:         ScenarioContext | null;
  messages:         ChatMessage[];
  streamingContent: string;
  error:            string | null;
  sendMessage:      (content: string) => void;
  sendAudio:        (audioBase64: string, mimeType: string) => void;
  endSession:       () => void;
}

const WS_BASE = (process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001")
  .replace(/^http/, "ws");

export function useChatSocket({
  sessionId,
  language,
  level,
  scenarioRequest,
  onSTTResult,
}: UseChatSocketOptions): UseChatSocketReturn {
  const [connectionState,  setConnectionState]  = useState<ConnectionState>("connecting");
  const [scenario,         setScenario]          = useState<ScenarioContext | null>(null);
  const [messages,         setMessages]          = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent]  = useState("");
  const [error,            setError]             = useState<string | null>(null);

  const wsRef             = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnects     = 5;
  const isEndedRef        = useRef(false);
  // Keep onSTTResult in a ref so it never invalidates the connect callback
  const onSTTResultRef    = useRef(onSTTResult);
  useEffect(() => { onSTTResultRef.current = onSTTResult; }, [onSTTResult]);

  const connect = useCallback(() => {
    // Reset ended flag so this fresh connection can reconnect if it drops
    isEndedRef.current = false;

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
      setConnectionState("connecting");
      // Always send start_session — the server handles reconnects gracefully
      // (won't re-save the opening message if messages already exist).
      // This also fixes React Strict Mode's double-effect in development,
      // where the cleanup fires between the two effect invocations.
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
          const m = msg.message as ChatMessage;
          setMessages(prev => [...prev, m]);
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
        case "stt_result": {
          onSTTResultRef.current?.(msg.transcript as string);
          break;
        }
        case "session_ended": {
          isEndedRef.current = true;
          setConnectionState("ended");
          ws.close();
          break;
        }
        case "error": {
          setError((msg.message as string) ?? "An error occurred");
          break;
        }
        case "pong": {
          break;
        }
      }
    };

    ws.onclose = () => {
      // Only clear the ref if this is still the active connection.
      // In React Strict Mode, the old WS can fire onclose after a new one
      // has already been stored in wsRef — don't wipe the newer connection.
      if (wsRef.current === ws) wsRef.current = null;
      if (isEndedRef.current) return;

      if (reconnectAttempts.current < maxReconnects) {
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttempts.current),
          30_000
        );
        reconnectAttempts.current++;
        setConnectionState("reconnecting");
        setError(`Connection lost. Reconnecting in ${Math.round(delay / 1000)}s…`);
        setTimeout(() => {
          setError(null);
          connect();
        }, delay);
      } else {
        setConnectionState("error");
        setError("Connection lost. Please refresh the page.");
      }
    };

    ws.onerror = () => {
      setError("WebSocket error occurred");
    };

  }, [sessionId, language, level, scenarioRequest]);

  useEffect(() => {
    connect();
    return () => {
      isEndedRef.current = true;
      reconnectAttempts.current = maxReconnects + 1;
      wsRef.current?.close();
    };
  }, [connect]);

  // Heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 25_000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setError("Not connected. Please wait.");
      return;
    }
    if (connectionState !== "ready") return;
    if (!content.trim()) return;
    wsRef.current.send(JSON.stringify({
      type: "send_message",
      content: content.trim(),
    }));
  }, [connectionState]);

  // ── NEW: send audio to backend for STT ──────────────────────────────
  const sendAudio = useCallback((audioBase64: string, mimeType: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setError("Not connected. Please wait.");
      return;
    }
    if (connectionState !== "ready") return;
    wsRef.current.send(JSON.stringify({
      type:  "send_audio",
      audio: audioBase64,
      mimeType,
    }));
  }, [connectionState]);

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
    sendAudio,
    endSession,
  };
}
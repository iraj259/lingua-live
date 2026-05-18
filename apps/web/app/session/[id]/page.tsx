"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Send, Loader2, StopCircle,
  Mic, MicOff, Volume2, VolumeX, Wifi, WifiOff,
} from "lucide-react";
import { useAuth }             from "@/lib/auth-context";
import { useChatSocket }       from "@/lib/use-chat-socket";
import { useAudioCapture }     from "@/lib/use-audio-capture";
import { useSpeechSynthesis }  from "@/lib/use-speech-synthesis";
import { LANGUAGE_CONFIG, LEVEL_CONFIG, formatDuration, cn } from "@/lib/utils";
import type { Language, Level } from "@/lib/api";
import type { ChatMessage }    from "@/lib/use-chat-socket";

// ── Typing dots ────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-border">
        <div className="flex items-center gap-1.5 h-4">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────
function Bubble({
  message,
  streaming,
}: {
  message?:  ChatMessage;
  streaming?: string;
}) {
  const isUser  = message?.role === "user";
  const content = message?.content ?? streaming ?? "";

  if (!message && !streaming) return <TypingDots />;

  return (
    <div className={cn("flex animate-slide-up", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
        isUser
          ? "bg-ink text-paper rounded-br-sm"
          : "bg-white border border-border text-ink rounded-bl-sm"
      )}>
        {content}
        {streaming !== undefined && !message && (
          <span className="inline-block w-0.5 h-4 bg-accent ml-0.5 align-middle animate-pulse" />
        )}
      </div>
    </div>
  );
}

// ── Audio level visualizer ─────────────────────────────────────────────────
function AudioVisualizer({ level }: { level: number }) {
  const bars = 5;
  return (
    <div className="flex items-center gap-0.5 h-5">
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = (i + 1) / bars;
        const active    = level > threshold * 0.4;
        return (
          <div
            key={i}
            className={cn(
              "w-1 rounded-full transition-all duration-75",
              active ? "bg-danger" : "bg-border"
            )}
            style={{
              height: active
                ? `${Math.min(100, level * 200 + 20)}%`
                : "30%",
            }}
          />
        );
      })}
    </div>
  );
}

// ── Persona card ───────────────────────────────────────────────────────────
function PersonaCard({
  personaName,
  personaRole,
  setting,
  language,
  level,
  isSpeaking,
}: {
  personaName: string;
  personaRole: string;
  setting:     string;
  language:    Language;
  level:       Level;
  isSpeaking:  boolean;
}) {
  const lang = LANGUAGE_CONFIG[language];
  const lvl  = LEVEL_CONFIG[level];

  return (
    <div className="border-b border-border bg-cream/50 px-6 py-3">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <div className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center text-paper font-semibold text-sm flex-shrink-0 transition-all",
          isSpeaking ? "bg-accent ring-2 ring-accent/30 ring-offset-1" : "bg-ink"
        )}>
          {personaName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink">{personaName}</span>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">{personaRole}</span>
            {isSpeaking && (
              <span className="text-[10px] font-medium text-accent bg-accent-soft px-2 py-0.5 rounded-full animate-pulse">
                Speaking…
              </span>
            )}
            <span className={cn("badge text-[10px] ml-auto", lvl?.color ?? "")}>
              {lvl?.label}
            </span>
            <span className="text-base">{lang?.flag}</span>
          </div>
          <p className="text-xs text-muted truncate mt-0.5">{setting}</p>
        </div>
      </div>
    </div>
  );
}

// ── Status bar ─────────────────────────────────────────────────────────────
function StatusBar({
  state,
  error,
}: {
  state: string;
  error: string | null;
}) {
  if (state === "ready" && !error) return null;

  const configs: Record<string, { icon: React.ReactNode; text: string; classes: string }> = {
    connecting:   { icon: <Loader2 size={13} className="animate-spin" />, text: "Setting up your session…",    classes: "bg-accent-soft text-accent border-accent/20" },
    reconnecting: { icon: <Wifi size={13} />,    text: error ?? "Reconnecting…",     classes: "bg-amber-50 text-amber-700 border-amber-200" },
    error:        { icon: <WifiOff size={13} />, text: error ?? "Connection error",  classes: "bg-red-50 text-red-700 border-red-200" },
    ended:        { icon: null,                  text: "Session ended",              classes: "bg-cream text-muted border-border" },
  };

  const cfg = configs[state];
  if (!cfg) return null;

  return (
    <div className={cn("border-b px-6 py-2", cfg.classes)}>
      <div className="max-w-3xl mx-auto flex items-center gap-2">
        {cfg.icon}
        <span className="text-xs">{cfg.text}</span>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function SessionPage({
  params,
}: {
  params: { id: string };
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const language        = (searchParams.get("language") ?? "spanish") as Language;
  const level           = (searchParams.get("level")    ?? "beginner") as Level;
  const scenarioRequest = decodeURIComponent(searchParams.get("scenario") ?? "general conversation");

  const [input,   setInput]   = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // ── Speech synthesis ─────────────────────────────────────────────────
  const { speak, cancel: cancelSpeech, isSpeaking } =
    useSpeechSynthesis(language);

  // ── WebSocket chat ────────────────────────────────────────────────────
  const {
    connectionState,
    scenario,
    messages,
    streamingContent,
    error,
    sendMessage,
    sendAudio,
    endSession,
  } = useChatSocket({
    sessionId:       params.id,
    language,
    level,
    scenarioRequest,
    // When STT result arrives, put it in the input box
    // so the user can see what was heard
    onSTTResult: (transcript) => {
      setInput(transcript);
    },
  });

  // ── Audio capture ─────────────────────────────────────────────────────
  const { isRecording, hasPermission, audioLevel, startRecording, stopRecording } =
    useAudioCapture({
      onAudioReady: (audioBase64, mimeType) => {
        // Send audio to backend for STT
        sendAudio(audioBase64, mimeType);
      },
    });

  // ── Speak AI messages when they complete ──────────────────────────────
  useEffect(() => {
    if (isMuted) return;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && streamingContent === "") {
      speak(last.content);
    }
  }, [messages, streamingContent, isMuted, speak]);

  // ── Cancel speech when user starts recording ──────────────────────────
  useEffect(() => {
    if (isRecording) cancelSpeech();
  }, [isRecording, cancelSpeech]);

  // ── Timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (connectionState === "ended" && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [connectionState]);

  // ── Auto scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // ── Redirect to summary when session ends ─────────────────────────────
  useEffect(() => {
    if (connectionState !== "ended") return;
    const t = setTimeout(
      () => router.push(`/session/${params.id}/summary`),
      1500
    );
    return () => clearTimeout(t);
  }, [connectionState, params.id, router]);

  // ── Send text message ─────────────────────────────────────────────────
  function handleSend() {
    const text = input.trim();
    if (!text || connectionState !== "ready" || streamingContent) return;
    sendMessage(text);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
  }

  // ── Push to talk ──────────────────────────────────────────────────────
  function handleMicMouseDown() {
    if (connectionState !== "ready" || streamingContent) return;
    startRecording();
  }

  function handleMicMouseUp() {
    if (!isRecording) return;
    stopRecording();
  }

  if (authLoading || !user) return null;

  const lang      = LANGUAGE_CONFIG[language];
  const isEnded   = connectionState === "ended";
  const isStreaming = streamingContent.length > 0;
  const canSend   = input.trim().length > 0 && connectionState === "ready" && !isStreaming;
  const canRecord = connectionState === "ready" && !isStreaming;

  return (
    <div className="h-dvh flex flex-col bg-paper">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/dashboard" className="btn-ghost p-2 -ml-2 flex-shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{lang?.flag}</span>
              <span className="text-sm font-semibold text-ink">{lang?.label}</span>
              {connectionState === "ready" && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-success bg-emerald-50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  Live
                </span>
              )}
            </div>
            {elapsed > 0 && (
              <p className="text-xs text-muted mt-0.5">{formatDuration(elapsed)}</p>
            )}
          </div>

          {/* Mute toggle */}
          <button
            onClick={() => { setIsMuted(m => !m); if (!isMuted) cancelSpeech(); }}
            className="btn-ghost p-2"
            title={isMuted ? "Unmute AI voice" : "Mute AI voice"}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button
            onClick={endSession}
            disabled={connectionState !== "ready"}
            className={cn(
              "btn-secondary py-2 px-3 text-xs flex-shrink-0",
              connectionState !== "ready" && "opacity-40"
            )}
          >
            <StopCircle size={13} /> End
          </button>
        </div>
      </header>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      <StatusBar state={connectionState} error={error} />

      {/* ── Persona card ────────────────────────────────────────────── */}
      {scenario && (
        <PersonaCard
          personaName={scenario.personaName}
          personaRole={scenario.personaRole}
          setting={scenario.setting}
          language={language}
          level={level}
          isSpeaking={isSpeaking}
        />
      )}

      {/* ── Messages ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-3">
          {messages.length === 0 && !streamingContent && connectionState === "connecting" && (
            <div className="flex items-center justify-center py-20 text-center">
              <div>
                <p className="text-4xl mb-3">{lang?.flag}</p>
                <p className="text-sm text-muted">Preparing your tutor…</p>
              </div>
            </div>
          )}

          {messages.map(msg => (
            <Bubble key={msg.id} message={msg} />
          ))}

          {isStreaming && <Bubble streaming={streamingContent} />}

          {connectionState === "ready" &&
           !isStreaming &&
           messages.length > 0 &&
           messages[messages.length - 1]?.role === "user" && (
            <TypingDots />
          )}

          {isEnded && (
            <div className="py-4 text-center animate-fade-in">
              <p className="text-xs text-muted">
                Session ended · Redirecting to summary…
              </p>
            </div>
          )}

          <div ref={bottomRef} className="h-2" />
        </div>
      </div>

      {/* ── Input bar ───────────────────────────────────────────────── */}
      {!isEnded && (
        <div className="border-t border-border bg-white">
          <div className="max-w-3xl mx-auto px-6 py-4">
            <div className="flex gap-3 items-end">

              {/* Text input */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRecording
                    ? "Listening…"
                    : connectionState === "connecting"
                    ? "Waiting for session to start…"
                    : isStreaming
                    ? "AI is responding…"
                    : `Type or hold 🎤 to speak…`
                }
                rows={1}
                disabled={connectionState !== "ready" || isStreaming || isRecording}
                className={cn(
                  "flex-1 input resize-none py-3 leading-relaxed min-h-[44px] max-h-[150px]",
                  (connectionState !== "ready" || isStreaming || isRecording) &&
                    "opacity-60 cursor-not-allowed bg-cream"
                )}
                style={{ height: "44px" }}
              />

              {/* Mic button — push to talk */}
              <button
                onMouseDown={handleMicMouseDown}
                onMouseUp={handleMicMouseUp}
                onTouchStart={(e) => { e.preventDefault(); handleMicMouseDown(); }}
                onTouchEnd={(e)   => { e.preventDefault(); handleMicMouseUp(); }}
                disabled={!canRecord}
                className={cn(
                  "h-[44px] w-[44px] p-0 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                  isRecording
                    ? "bg-danger text-white ring-4 ring-danger/20 scale-110"
                    : canRecord
                    ? "bg-cream border border-border text-muted hover:bg-cream hover:text-ink"
                    : "bg-cream border border-border text-muted opacity-40 cursor-not-allowed"
                )}
                title="Hold to speak"
              >
                {isRecording
                  ? <AudioVisualizer level={audioLevel} />
                  : <Mic size={18} />
                }
              </button>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  "btn-accent h-[44px] w-[44px] p-0 rounded-xl flex-shrink-0",
                  !canSend && "opacity-40 cursor-not-allowed"
                )}
              >
                {isStreaming
                  ? <Loader2 size={18} className="animate-spin" />
                  : <Send size={18} />
                }
              </button>
            </div>

            {/* Mic hint */}
            <p className="text-[10px] text-muted text-center mt-2">
              {isRecording
                ? "Release to send"
                : hasPermission === false
                ? "Microphone access denied — text only"
                : "Hold 🎤 to speak · Enter to send · Shift+Enter for new line"
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
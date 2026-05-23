"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Send, Loader2, StopCircle,
  Mic, VolumeX, WifiOff, Languages,
} from "lucide-react";
import { useAuth }            from "@/lib/auth-context";
import { useChatSocket }      from "@/lib/use-chat-socket";
import { useAudioCapture }    from "@/lib/use-audio-capture";
import { useSpeechSynthesis } from "@/lib/use-speech-synthesis";
import { chatApi }            from "@/lib/api";
import { LANGUAGE_CONFIG, LEVEL_CONFIG, formatDuration, cn } from "@/lib/utils";
import type { Language, Level } from "@/lib/api";
import type { ChatMessage }   from "@/lib/use-chat-socket";
import { Aurora }        from "@/components/aurora";
import { VoiceOverlay } from "@/components/voice-overlay";

// ── Typing dots ────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex justify-start">
      <div style={{
        padding: "12px 16px", borderRadius: 18, borderBottomLeftRadius: 4,
        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
      }}>
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
  language,
  level,
  onSuggest,
}: {
  message?:   ChatMessage;
  streaming?: string;
  language?:  Language;
  level?:     Level;
  onSuggest?: (text: string) => void;
}) {
  const isUser  = message?.role === "user";
  const content = message?.content ?? streaming ?? "";

  const [showTranslation, setShowTranslation] = useState(false);
  const [translation,     setTranslation]     = useState<string | null>(null);
  const [translating,     setTranslating]     = useState(false);

  const [showHints, setShowHints]   = useState(false);
  const [hints,     setHints]       = useState<{ reply: string; english: string }[] | null>(null);
  const [loadingHints, setLoadingHints] = useState(false);

  if (!message && !streaming) return <TypingDots />;

  async function handleTranslate() {
    if (!message?.content || !language) return;
    if (translation) { setShowTranslation(v => !v); return; }
    setTranslating(true);
    try {
      const { translation: t } = await chatApi.translate(message.content, language);
      setTranslation(t);
      setShowTranslation(true);
    } catch {
      setTranslation("Translation unavailable.");
      setShowTranslation(true);
    } finally {
      setTranslating(false);
    }
  }

  async function handleHints() {
    if (!message?.content || !language || !level) return;
    if (hints) { setShowHints(v => !v); return; }
    setLoadingHints(true);
    setShowHints(true);
    try {
      const { suggestions } = await chatApi.suggest(message.content, language, level);
      setHints(suggestions);
    } catch {
      setHints([]);
    } finally {
      setLoadingHints(false);
    }
  }

  const showActions = !isUser && message && !streaming && language;

  return (
    <div className={cn("flex animate-slide-up", isUser ? "justify-end" : "justify-start")}>
      <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", gap: 0 }}>

        {/* Bubble */}
        <div style={{
          padding: "12px 16px",
          borderRadius: 18,
          fontSize: 14.5,
          lineHeight: 1.5,
          background: isUser
            ? "linear-gradient(135deg, rgba(168,85,247,0.85), rgba(124,58,237,0.85))"
            : "rgba(255,255,255,0.06)",
          border: `1px solid rgba(255,255,255,${isUser ? "0.18" : "0.08"})`,
          color: isUser ? "#fff" : "var(--ink)",
          borderBottomRightRadius: isUser ? 4 : 18,
          borderBottomLeftRadius: !isUser ? 4 : 18,
          whiteSpace: "pre-wrap",
        }}>
          {content}
          {streaming !== undefined && !message && (
            <span style={{
              display: "inline-block", width: 2, height: 16,
              background: "#c084fc", marginLeft: 4, verticalAlign: "-3px",
              animation: "blink 1s steps(2) infinite",
            }} />
          )}

          {/* Inline translation — shown inside the bubble when toggled */}
          {showTranslation && translation && (
            <div style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              fontSize: 12.5,
              color: "rgba(192,132,252,0.75)",
              fontStyle: "italic",
              lineHeight: 1.5,
            }}>
              <span style={{
                fontSize: 9, fontFamily: "var(--font-jetbrains)", letterSpacing: ".1em",
                color: "rgba(192,132,252,0.45)", display: "block", marginBottom: 3, fontStyle: "normal",
              }}>EN</span>
              {translation}
            </div>
          )}
        </div>

        {/* Action row */}
        {showActions && (
          <div style={{
            display: "flex", gap: 6, marginTop: 5, paddingLeft: 2,
          }}>
            {/* Translate toggle */}
            <button
              onClick={handleTranslate}
              disabled={translating}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 9px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                background: showTranslation ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${showTranslation ? "rgba(168,85,247,0.35)" : "rgba(255,255,255,0.1)"}`,
                color: showTranslation ? "#c084fc" : "var(--ink-mute)",
                transition: "all .15s",
              }}
            >
              {translating ? <Loader2 size={10} className="animate-spin" /> : <Languages size={10} />}
              EN
            </button>

            {/* Suggest hint toggle */}
            {level && (
              <button
                onClick={handleHints}
                disabled={loadingHints}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 9px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                  background: showHints ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${showHints ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.1)"}`,
                  color: showHints ? "#fcd34d" : "var(--ink-mute)",
                  transition: "all .15s",
                }}
              >
                {loadingHints ? <Loader2 size={10} className="animate-spin" /> : "💡"}
                Hint
              </button>
            )}
          </div>
        )}

        {/* Hint pills */}
        {showHints && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {loadingHints ? (
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{
                    height: 30, borderRadius: 999, flex: 1,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    animation: "pulse 1.4s ease-in-out infinite",
                    animationDelay: `${i * 0.15}s`,
                  }} />
                ))}
              </div>
            ) : hints && hints.length > 0 ? (
              hints.map((h, i) => (
                <button
                  key={i}
                  onClick={() => onSuggest?.(h.reply)}
                  style={{
                    textAlign: "left", padding: "8px 12px", borderRadius: 12, cursor: "pointer",
                    background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.18)",
                    transition: "all .15s",
                    display: "block", width: "100%",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(251,191,36,0.12)"; e.currentTarget.style.borderColor = "rgba(251,191,36,0.35)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(251,191,36,0.05)"; e.currentTarget.style.borderColor = "rgba(251,191,36,0.18)"; }}
                >
                  <div style={{ fontSize: 13, color: "#fff", lineHeight: 1.4 }}>{h.reply}</div>
                  <div style={{ fontSize: 11, color: "rgba(252,211,77,0.55)", marginTop: 2, fontStyle: "italic" }}>{h.english}</div>
                </button>
              ))
            ) : hints?.length === 0 ? (
              <p style={{ fontSize: 11, color: "var(--ink-mute)", padding: "4px 2px" }}>No hints available.</p>
            ) : null}
          </div>
        )}
      </div>
      <style>{`@keyframes blink { 50% { opacity: 0; } } @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </div>
  );
}

// ── Audio visualizer ───────────────────────────────────────────────────────
function AudioVisualizer({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5 h-5">
      {Array.from({ length: 5 }).map((_, i) => {
        const active = level > ((i + 1) / 5) * 0.4;
        return (
          <div key={i} style={{
            width: 3, borderRadius: 2,
            background: active ? "#f87171" : "rgba(255,255,255,0.2)",
            height: active ? `${Math.min(100, level * 200 + 20)}%` : "30%",
            transition: "height 75ms, background 75ms",
          }} />
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function SessionPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <SessionContent params={params} />
    </Suspense>
  );
}

function SessionContent({ params }: { params: { id: string } }) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const language        = (searchParams.get("language") ?? "spanish") as Language;
  const level           = (searchParams.get("level")    ?? "beginner") as Level;
  const scenarioRequest = decodeURIComponent(searchParams.get("scenario") ?? "general conversation");

  const [input,   setInput]   = useState("");
  const [elapsed, setElapsed] = useState(0);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  const { speak, cancel: cancelSpeech, isSpeaking } = useSpeechSynthesis(language);

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
    onSTTResult: (transcript) => setInput(transcript),
  });

  const { isRecording, hasPermission, audioLevel, startRecording, stopRecording } =
    useAudioCapture({
      onAudioReady: (audioBase64, mimeType) => sendAudio(audioBase64, mimeType),
    });

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && streamingContent === "") speak(last.content);
  }, [messages, streamingContent, speak]);

  useEffect(() => { if (isRecording) cancelSpeech(); }, [isRecording, cancelSpeech]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (connectionState === "ended" && timerRef.current) clearInterval(timerRef.current);
  }, [connectionState]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (connectionState !== "ended") return;
    cancelSpeech();
    const t = setTimeout(() => router.push(`/session/${params.id}/summary`), 1500);
    return () => clearTimeout(t);
  }, [connectionState, params.id, router, cancelSpeech]);

  function handleSend() {
    const text = input.trim();
    if (!text || connectionState !== "ready" || streamingContent) return;
    sendMessage(text);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
  }

  function handleMicDown() {
    if (connectionState !== "ready" || streamingContent) return;
    startRecording();
  }
  function handleMicUp() { if (isRecording) stopRecording(); }

  if (authLoading || !user) return null;

  const lang      = LANGUAGE_CONFIG[language];
  const lvl       = LEVEL_CONFIG[level];
  const isEnded   = connectionState === "ended";
  const isStreaming = streamingContent.length > 0;
  const canSend   = input.trim().length > 0 && connectionState === "ready" && !isStreaming;
  const canRecord = connectionState === "ready" && !isStreaming;

  function fmt(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", position: "relative" }}>
      <Aurora intensity={0.5} />
      <div className="grain" />

      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100dvh" }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)",
          background: "rgba(5,2,8,0.65)",
          flexShrink: 0,
        }}>
          <div style={{ maxWidth: 768, margin: "0 auto", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/dashboard" style={{
              display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
              color: "var(--ink-dim)", textDecoration: "none", flexShrink: 0,
              transition: "all .2s",
            }}>
              <ArrowLeft size={16} />
            </Link>

            {/* Persona */}
            {scenario ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, var(--violet-2), var(--magenta))",
                  display: "grid", placeItems: "center", color: "#fff", fontSize: 13, fontWeight: 500,
                  boxShadow: "0 0 16px rgba(168,85,247,0.5)",
                }}>
                  {scenario.personaName.charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {scenario.personaName}
                    {isSpeaking && (
                      <button
                        onClick={cancelSpeech}
                        style={{
                          marginLeft: 8, fontSize: 10, color: "#c084fc",
                          background: "rgba(168,85,247,0.15)", padding: "2px 8px", borderRadius: 999,
                          border: "1px solid rgba(168,85,247,0.3)", cursor: "pointer",
                          animation: "pulseGlow 1.5s infinite",
                          display: "inline-flex", alignItems: "center", gap: 4,
                          transition: "background .15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(168,85,247,0.35)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(168,85,247,0.15)"; }}
                      >
                        <VolumeX size={9} /> Stop
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-mute)", fontFamily: "var(--font-jetbrains)" }}>
                    {lang?.flag} {lang?.label} · {lvl?.label} · {fmt(elapsed)}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{lang?.flag}</span>
                <span style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{lang?.label}</span>
                {connectionState === "ready" && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 10, color: "#34d399", background: "rgba(52,211,153,0.1)",
                    border: "1px solid rgba(52,211,153,0.25)", padding: "2px 8px", borderRadius: 999,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", animation: "pulseGlow 2s infinite" }} />
                    Live
                  </span>
                )}
              </div>
            )}

            {/* Controls */}
            <button
              onClick={endSession}
              disabled={connectionState !== "ready"}
              className="btn-ghost"
              style={{ padding: "7px 12px", fontSize: 11, flexShrink: 0, opacity: connectionState !== "ready" ? 0.4 : 1 }}
            >
              <StopCircle size={12} /> End
            </button>
          </div>

          {/* Status strip */}
          {connectionState !== "ready" && connectionState !== "ended" && (
            <div style={{
              padding: "8px 20px", fontSize: 12, display: "flex", alignItems: "center", gap: 8,
              background: connectionState === "error"
                ? "rgba(248,113,113,0.08)"
                : "rgba(168,85,247,0.08)",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              color: connectionState === "error" ? "#fca5a5" : "var(--ink-dim)",
            }}>
              {connectionState === "error"
                ? <><WifiOff size={12} /> {error ?? "Connection error"}</>
                : <><Loader2 size={12} className="animate-spin" /> Setting up your session…</>
              }
            </div>
          )}

          {/* Persona setting */}
          {scenario && (
            <div style={{
              padding: "8px 20px", borderTop: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(255,255,255,0.02)",
            }}>
              <div style={{ maxWidth: 768, margin: "0 auto", fontSize: 11.5, color: "var(--ink-dim)" }}>
                📍 {scenario.setting}
              </div>
            </div>
          )}
        </header>

        {/* ── Messages ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>

            {messages.length === 0 && !streamingContent && connectionState === "connecting" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", textAlign: "center" }}>
                <div>
                  <p style={{ fontSize: 48, marginBottom: 12 }}>{lang?.flag}</p>
                  <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>Preparing your tutor…</p>
                </div>
              </div>
            )}

            {messages.map(msg => (
              <Bubble
                key={msg.id}
                message={msg}
                language={language}
                level={level}
                onSuggest={text => { setInput(text); setTimeout(() => inputRef.current?.focus(), 50); }}
              />
            ))}

            {isStreaming && <Bubble streaming={streamingContent} language={language} level={level} />}

            {connectionState === "ready" &&
             !isStreaming &&
             messages.length > 0 &&
             messages[messages.length - 1]?.role === "user" && (
              <TypingDots />
            )}

            {isEnded && (
              <div style={{ padding: "16px 0", textAlign: "center" }} className="animate-fade-in">
                <p style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                  Session ended · Redirecting to summary…
                </p>
              </div>
            )}

            <div ref={bottomRef} style={{ height: 8 }} />
          </div>
        </div>

        {/* ── Voice overlay (appears when mic is held) ───────────────── */}
        <VoiceOverlay
          isVisible={isRecording}
          isRecording={isRecording}
          personaName={scenario?.personaName}
          language={lang?.label}
          onRelease={handleMicUp}
        />

        {/* ── Input bar ───────────────────────────────────────────────── */}
        {!isEnded && (
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(5,2,8,0.7)", backdropFilter: "blur(20px)",
            flexShrink: 0,
          }}>
            {/* Floating stop-speaking pill */}
            {isSpeaking && (
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 10 }}>
                <button
                  onClick={cancelSpeech}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "8px 18px", borderRadius: 999,
                    background: "linear-gradient(135deg, rgba(124,58,237,0.7), rgba(168,85,247,0.5))",
                    border: "1px solid rgba(192,132,252,0.5)",
                    color: "#e9d5ff", fontSize: 12.5, fontWeight: 500,
                    cursor: "pointer", backdropFilter: "blur(12px)",
                    boxShadow: "0 4px 20px rgba(168,85,247,0.35)",
                    animation: "slideUpFade .2s ease",
                    transition: "background .15s, transform .1s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  <VolumeX size={13} />
                  Stop speaking
                </button>
              </div>
            )}
            <style>{`@keyframes slideUpFade { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
            <div style={{ maxWidth: 720, margin: "0 auto", padding: "10px 12px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isRecording         ? "Listening…"
                    : connectionState === "connecting" ? "Waiting for session…"
                    : isStreaming       ? `${scenario?.personaName ?? "AI"} is responding…`
                    : `Type in ${lang?.label ?? "the language"}… or hold 🎤`
                  }
                  rows={1}
                  disabled={connectionState !== "ready" || isStreaming || isRecording}
                  className="glass-input"
                  style={{
                    flex: 1, resize: "none", minHeight: 48, maxHeight: 150, fontSize: 14,
                    padding: "13px 16px",
                    opacity: (connectionState !== "ready" || isStreaming || isRecording) ? 0.6 : 1,
                  }}
                />

                {/* Mic button */}
                <button
                  onMouseDown={handleMicDown}
                  onMouseUp={handleMicUp}
                  onTouchStart={e => { e.preventDefault(); handleMicDown(); }}
                  onTouchEnd={e   => { e.preventDefault(); handleMicUp(); }}
                  disabled={!canRecord}
                  style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    display: "grid", placeItems: "center", cursor: canRecord ? "pointer" : "not-allowed",
                    background: isRecording
                      ? "linear-gradient(135deg, #f87171, #ef4444)"
                      : "rgba(255,255,255,0.05)",
                    border: isRecording
                      ? "1px solid rgba(248,113,113,0.5)"
                      : "1px solid rgba(255,255,255,0.15)",
                    transform: isRecording ? "scale(1.06)" : "scale(1)",
                    boxShadow: isRecording ? "0 0 16px rgba(248,113,113,0.4)" : "none",
                    transition: "all .2s",
                    opacity: canRecord ? 1 : 0.4,
                    color: isRecording ? "#fff" : "var(--ink-dim)",
                  }}
                >
                  {isRecording ? <AudioVisualizer level={audioLevel} /> : <Mic size={18} />}
                </button>

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className="btn-violet"
                  style={{ width: 48, height: 48, borderRadius: 14, padding: 0, display: "grid", placeItems: "center", flexShrink: 0, opacity: canSend ? 1 : 0.4 }}
                >
                  {isStreaming
                    ? <Loader2 size={18} className="animate-spin" />
                    : <Send size={18} />
                  }
                </button>
              </div>

              <p style={{ fontSize: 10.5, color: "var(--ink-mute)", textAlign: "center", marginTop: 8 }}>
                {isRecording
                  ? "Release to send"
                  : hasPermission === false
                  ? "Microphone access denied — text only"
                  : <><span className="hidden sm:inline">Enter to send · Shift+Enter for new line · </span>Hold 🎤 to speak</>
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

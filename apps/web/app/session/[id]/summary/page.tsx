"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, CheckCircle, AlertCircle, Lightbulb, Star } from "lucide-react";
import { sessionsApi, feedbackApi, ApiError, type Session, type Message, type FeedbackReport } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LANGUAGE_CONFIG, LEVEL_CONFIG, formatDuration, formatDate, formatTime, cn } from "@/lib/utils";
import type { Language, Level } from "@/lib/api";
import { Aurora } from "@/components/aurora";

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r    = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 10) * circ;
  const stroke = score >= 8 ? "#34d399" : score >= 6 ? "#fbbf24" : "#f87171";

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ position: "relative", width: 72, height: 72 }}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${stroke})` }}
          />
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: "#fff" }}>
          {score.toFixed(1)}
        </span>
      </div>
      <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>{label}</span>
    </div>
  );
}

export default function SummaryPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, logout, isLoading: authLoading } = useAuth();

  const [session,  setSession]  = useState<Session | null>(null);
  const [msgs,     setMsgs]     = useState<Message[]>([]);
  const [scenario, setScenario] = useState<{ personaName: string; personaRole: string; setting: string } | null>(null);
  const [feedback, setFeedback] = useState<FeedbackReport | null>(null);
  const [pending,  setPending]  = useState(true);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => { if (!authLoading && !user) router.replace("/login"); }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([sessionsApi.get(params.id), feedbackApi.get(params.id)])
      .then(([{ session: s, messages: m }, fb]) => {
        setSession(s);
        setMsgs(m);
        if (s.scenarioContext) {
          const ctx = s.scenarioContext as { personaName?: string; personaRole?: string; setting?: string };
          if (ctx.personaName) setScenario({ personaName: ctx.personaName, personaRole: ctx.personaRole ?? "", setting: ctx.setting ?? "" });
        }
        if (!fb.pending && fb.report) { setFeedback(fb.report); setPending(false); }
      })
      .catch(err => { if (err instanceof ApiError && err.status === 401) logout(); })
      .finally(() => setLoading(false));
  }, [user, params.id, logout]);

  const pollFeedback = useCallback(() => {
    feedbackApi.get(params.id)
      .then(fb => { if (!fb.pending && fb.report) { setFeedback(fb.report); setPending(false); } })
      .catch(() => {});
  }, [params.id]);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(pollFeedback, 3000);
    return () => clearInterval(timer);
  }, [pending, pollFeedback]);

  if (authLoading || !user || loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 20, height: 20, border: "2px solid var(--violet-2)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!session) return null;

  const lang         = LANGUAGE_CONFIG[session.language as Language];
  const level        = LEVEL_CONFIG[session.level as Level];
  const userMsgCount = msgs.filter(m => m.role === "user").length;

  return (
    <div style={{ position: "relative", minHeight: "100dvh" }}>
      <Aurora intensity={0.5} />
      <div className="grain" />

      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Header */}
        <header style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)", background: "rgba(5,2,8,0.6)",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <div style={{ maxWidth: 768, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/dashboard" style={{
              display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
              color: "var(--ink-dim)", textDecoration: "none", flexShrink: 0,
            }}>
              <ArrowLeft size={16} />
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 13, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session.title ?? `${lang?.label} session`}
              </h1>
              <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 1 }}>{formatDate(session.startedAt)}</p>
            </div>
            <Link href="/session/new" className="btn-violet" style={{ padding: "8px 14px", fontSize: 11, flexShrink: 0 }}>
              <Plus size={13} /> <span className="hidden sm:inline">New session</span><span className="sm:hidden">New</span>
            </Link>
          </div>
        </header>

        <main style={{ maxWidth: 768, margin: "0 auto", padding: "32px 24px" }}>

          {/* Persona card */}
          {scenario && (
            <div className="glass" style={{ borderRadius: 18, padding: 16, display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, var(--violet-2), var(--magenta))",
                display: "grid", placeItems: "center", color: "#fff", fontSize: 14, fontWeight: 600,
                boxShadow: "0 0 16px rgba(168,85,247,0.4)",
              }}>
                {scenario.personaName.charAt(0)}
              </div>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 500, color: "#fff" }}>{scenario.personaName}</p>
                <p style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 1 }}>{scenario.personaRole} · {scenario.setting}</p>
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3" style={{ gap: 10, marginBottom: 24 }}>
            {[
              { value: lang?.flag ?? "🌐", label: lang?.label ?? session.language },
              { value: userMsgCount,       label: "Messages sent" },
              { value: formatDuration(session.durationSeconds), label: "Duration" },
            ].map(({ value, label }) => (
              <div key={label} className="glass" style={{ borderRadius: 18, padding: 16, textAlign: "center" }}>
                <p style={{ fontSize: typeof value === "string" && value.length <= 3 ? 28 : 20, fontWeight: 600, color: "#fff" }}>{value}</p>
                <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Feedback */}
          {pending ? (
            <div className="glass" style={{ borderRadius: 18, padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 24, height: 24, border: "2px solid var(--violet-2)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>Generating your feedback report…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : feedback ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Score rings */}
              <div className="glass" style={{ borderRadius: 18, padding: 24 }}>
                <h2 className="section-label mb-6">Performance</h2>
                <div style={{ display: "flex", justifyContent: "space-around" }}>
                  <ScoreRing score={feedback.grammarScore} label="Grammar" />
                  <ScoreRing score={feedback.fluencyScore} label="Fluency" />
                  <ScoreRing score={feedback.vocabScore}   label="Vocabulary" />
                </div>
              </div>

              {/* Strengths */}
              {feedback.strengths.length > 0 && (
                <div className="glass" style={{ borderRadius: 18, padding: 20 }}>
                  <h2 className="section-label mb-4" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Star size={12} style={{ color: "#fbbf24" }} /> Strengths
                  </h2>
                  <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {feedback.strengths.map((s, i) => (
                      <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, color: "var(--ink)" }}>
                        <CheckCircle size={14} style={{ color: "#34d399", marginTop: 2, flexShrink: 0 }} />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Corrections */}
              {feedback.corrections.length > 0 && (
                <div className="glass" style={{ borderRadius: 18, padding: 20 }}>
                  <h2 className="section-label mb-4" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertCircle size={12} style={{ color: "#f87171" }} /> Corrections
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {feedback.corrections.map((c, i) => (
                      <div key={i} style={{ fontSize: 13 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ textDecoration: "line-through", color: "var(--ink-mute)" }}>{c.original}</span>
                          <span style={{ color: "var(--ink)", fontWeight: 500 }}>→ {c.corrected}</span>
                          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", background: "rgba(255,255,255,0.06)", color: "var(--ink-mute)", padding: "2px 6px", borderRadius: 6 }}>
                            {c.type}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--ink-dim)" }}>{c.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {feedback.suggestions.length > 0 && (
                <div className="glass" style={{ borderRadius: 18, padding: 20 }}>
                  <h2 className="section-label mb-4" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Lightbulb size={12} style={{ color: "#a78bfa" }} /> Suggestions
                  </h2>
                  <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {feedback.suggestions.map((s, i) => (
                      <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, color: "var(--ink)" }}>
                        <span style={{ color: "var(--violet-2)", fontWeight: 700, marginTop: 1 }}>·</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weakness tags */}
              {feedback.weaknessTags.length > 0 && (
                <div className="glass" style={{ borderRadius: 18, padding: 20 }}>
                  <h2 className="section-label mb-4">Areas to practice</h2>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {feedback.weaknessTags.map(tag => (
                      <span key={tag} style={{
                        display: "inline-block", padding: "4px 12px", borderRadius: 999,
                        background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)",
                        color: "#fca5a5", fontSize: 12,
                      }}>
                        {tag.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Full transcript */}
          <div style={{ marginTop: 32 }}>
            <h2 className="section-label mb-4">Full conversation</h2>
            {msgs.length === 0 ? (
              <div className="glass" style={{ borderRadius: 18, padding: 32, textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>No messages in this session.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {msgs.map(m => {
                  const isUser = m.role === "user";
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "80%", padding: "12px 16px", borderRadius: 18, fontSize: 13.5, lineHeight: 1.5,
                        background: isUser
                          ? "linear-gradient(135deg, rgba(168,85,247,0.85), rgba(124,58,237,0.85))"
                          : "rgba(255,255,255,0.06)",
                        border: `1px solid rgba(255,255,255,${isUser ? "0.18" : "0.08"})`,
                        color: isUser ? "#fff" : "var(--ink)",
                        borderBottomRightRadius: isUser ? 4 : 18,
                        borderBottomLeftRadius: !isUser ? 4 : 18,
                      }}>
                        <p>{m.content}</p>
                        <p style={{ fontSize: 10, marginTop: 4, opacity: 0.4, textAlign: isUser ? "right" : "left" }}>
                          {formatTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-center gap-3" style={{ paddingTop: 32, paddingBottom: 16 }}>
            <Link href="/session/new" className="btn-violet" style={{ padding: "14px 22px", fontSize: 13 }}>
              <Plus size={14} /> Practice again
            </Link>
            <Link href="/dashboard" className="btn-ghost" style={{ padding: "13px 22px", fontSize: 13 }}>
              Dashboard
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}

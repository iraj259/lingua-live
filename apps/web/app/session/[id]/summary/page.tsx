"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, CheckCircle, AlertCircle, Lightbulb, Star, Clock } from "lucide-react";
import { sessionsApi, feedbackApi, ApiError, type Session, type Message, type FeedbackReport } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LANGUAGE_CONFIG, LEVEL_CONFIG, formatDuration, formatDate, formatTime, cn } from "@/lib/utils";
import type { Language, Level } from "@/lib/api";

function ScoreRing({ score, label }: { score: number; label: string }) {
  const pct  = score / 10;
  const r    = 28;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  const color =
    score >= 8 ? "stroke-green-500" :
    score >= 6 ? "stroke-yellow-500" :
    "stroke-red-400";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={r}
            fill="none"
            className={color}
            strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-ink">
          {score.toFixed(1)}
        </span>
      </div>
      <span className="text-xs text-muted text-center">{label}</span>
    </div>
  );
}

function TagChip({ tag }: { tag: string }) {
  const label = tag.replace(/_/g, " ");
  return (
    <span className="inline-block bg-red-50 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full border border-red-200">
      {label}
    </span>
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
    Promise.all([
      sessionsApi.get(params.id),
      feedbackApi.get(params.id),
    ])
      .then(([{ session: s, messages: m }, fb]) => {
        setSession(s);
        setMsgs(m);
        if (s.scenarioContext) {
          const ctx = s.scenarioContext as { personaName?: string; personaRole?: string; setting?: string };
          if (ctx.personaName) setScenario({ personaName: ctx.personaName, personaRole: ctx.personaRole ?? "", setting: ctx.setting ?? "" });
        }
        if (!fb.pending && fb.report) {
          setFeedback(fb.report);
          setPending(false);
        }
      })
      .catch(err => { if (err instanceof ApiError && err.status === 401) logout(); })
      .finally(() => setLoading(false));
  }, [user, params.id, logout]);

  // Poll for feedback while it's still being generated
  const pollFeedback = useCallback(() => {
    feedbackApi.get(params.id)
      .then(fb => {
        if (!fb.pending && fb.report) {
          setFeedback(fb.report);
          setPending(false);
        }
      })
      .catch(() => {});
  }, [params.id]);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(pollFeedback, 3000);
    return () => clearInterval(timer);
  }, [pending, pollFeedback]);

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const lang         = LANGUAGE_CONFIG[session.language as Language];
  const level        = LEVEL_CONFIG[session.level as Level];
  const userMsgCount = msgs.filter(m => m.role === "user").length;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-border bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="btn-ghost p-2 -ml-2"><ArrowLeft size={18} /></Link>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-ink">
              {session.title ?? `${lang?.label} session`}
            </h1>
            <p className="text-xs text-muted">{formatDate(session.startedAt)}</p>
          </div>
          <Link href="/session/new" className="btn-primary text-sm py-2">
            <Plus size={15} /> New session
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* Persona */}
        {scenario && (
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-ink flex items-center justify-center text-paper font-semibold">
              {scenario.personaName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{scenario.personaName}</p>
              <p className="text-xs text-muted">{scenario.personaRole} · {scenario.setting}</p>
            </div>
          </div>
        )}

        {/* Session stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: lang?.label ?? session.language, value: lang?.flag ?? "🌐" },
            { label: "Messages sent",                 value: userMsgCount },
            { label: "Duration",                      value: formatDuration(session.durationSeconds) },
          ].map(({ label, value }) => (
            <div key={label} className="card p-4 text-center">
              <p className="text-2xl font-semibold text-ink">{value}</p>
              <p className="text-xs text-muted mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Feedback section */}
        {pending ? (
          <div className="card p-6 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted">Generating your feedback report…</p>
          </div>
        ) : feedback ? (
          <>
            {/* Score rings */}
            <div className="card p-6">
              <h2 className="section-label mb-5">Performance</h2>
              <div className="flex justify-around">
                <ScoreRing score={feedback.grammarScore} label="Grammar" />
                <ScoreRing score={feedback.fluencyScore} label="Fluency" />
                <ScoreRing score={feedback.vocabScore}   label="Vocabulary" />
              </div>
            </div>

            {/* Strengths */}
            {feedback.strengths.length > 0 && (
              <div className="card p-5">
                <h2 className="section-label mb-3 flex items-center gap-1.5">
                  <Star size={13} className="text-yellow-500" /> Strengths
                </h2>
                <ul className="space-y-2">
                  {feedback.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink">
                      <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Corrections */}
            {feedback.corrections.length > 0 && (
              <div className="card p-5">
                <h2 className="section-label mb-3 flex items-center gap-1.5">
                  <AlertCircle size={13} className="text-red-500" /> Corrections
                </h2>
                <div className="space-y-4">
                  {feedback.corrections.map((c, i) => (
                    <div key={i} className="text-sm space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="line-through text-muted">{c.original}</span>
                        <span className="text-ink font-medium">→ {c.corrected}</span>
                        <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {c.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted">{c.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {feedback.suggestions.length > 0 && (
              <div className="card p-5">
                <h2 className="section-label mb-3 flex items-center gap-1.5">
                  <Lightbulb size={13} className="text-blue-500" /> Suggestions
                </h2>
                <ul className="space-y-2">
                  {feedback.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink">
                      <span className="text-blue-400 font-bold mt-0.5">·</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Weakness tags */}
            {feedback.weaknessTags.length > 0 && (
              <div className="card p-5">
                <h2 className="section-label mb-3">Areas to practice</h2>
                <div className="flex flex-wrap gap-2">
                  {feedback.weaknessTags.map(tag => <TagChip key={tag} tag={tag} />)}
                </div>
              </div>
            )}
          </>
        ) : null}

        {/* Full transcript */}
        <div>
          <h2 className="section-label mb-4">Full conversation</h2>
          {msgs.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-muted">No messages in this session.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {msgs.map(m => {
                const isUser = m.role === "user";
                return (
                  <div key={m.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      isUser ? "bg-ink text-paper rounded-br-sm" : "bg-white border border-border text-ink rounded-bl-sm"
                    )}>
                      <p>{m.content}</p>
                      <p className={cn("text-[10px] mt-1 opacity-40", isUser ? "text-right" : "")}>
                        {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-center pb-6">
          <Link href="/session/new" className="btn-accent"><Plus size={16} /> Practice again</Link>
          <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
        </div>
      </main>
    </div>
  );
}

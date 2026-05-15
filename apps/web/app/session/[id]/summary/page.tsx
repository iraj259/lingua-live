"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { sessionsApi, ApiError, type Session, type Message } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LANGUAGE_CONFIG, LEVEL_CONFIG, formatDuration, formatDate, formatTime, cn } from "@/lib/utils";
import type { Language, Level } from "@/lib/api";

export default function SummaryPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, logout, isLoading: authLoading } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [msgs, setMsgs]       = useState<Message[]>([]);
  const [scenario, setScenario] = useState<{
  personaName: string;
  personaRole: string;
  setting: string;
} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!authLoading && !user) router.replace("/login"); }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    sessionsApi.get(params.id)
.then(({ session: s, messages: m }) => {
  setSession(s);
  setMsgs(m);
  // Extract scenario from the jsonb column if it exists
  if (s.scenarioContext) {
    const ctx = s.scenarioContext as { personaName?: string; personaRole?: string; setting?: string };
    if (ctx.personaName) {
      setScenario({
        personaName: ctx.personaName,
        personaRole: ctx.personaRole ?? "",
        setting:     ctx.setting ?? "",
      });
    }
  }
})      .catch(err => { if (err instanceof ApiError && err.status === 401) logout(); })
      .finally(() => setLoading(false));
  }, [user, params.id, logout]);

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const lang  = LANGUAGE_CONFIG[session.language as Language];
  const level = LEVEL_CONFIG[session.level as Level];
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

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Persona info if available */}
{scenario && (
  <div className="card p-4 flex items-center gap-3 mb-6">
    <div className="w-10 h-10 rounded-full bg-ink flex items-center justify-center text-paper font-semibold">
      {scenario.personaName.charAt(0)}
    </div>
    <div>
      <p className="text-sm font-semibold text-ink">{scenario.personaName}</p>
      <p className="text-xs text-muted">{scenario.personaRole} · {scenario.setting}</p>
    </div>
  </div>
)}
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: lang?.label ?? session.language, value: lang?.flag ?? "🌐" },
            { label: "Messages sent",    value: userMsgCount },
            { label: "Duration",         value: formatDuration(session.durationSeconds) },
          ].map(({ label, value }) => (
            <div key={label} className="card p-4 text-center">
              <p className="text-2xl font-semibold text-ink">{value}</p>
              <p className="text-xs text-muted mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-6">
          <span className={cn("badge", level?.color ?? "bg-gray-100 text-gray-600")}>{level?.label}</span>
          <span className="text-xs text-muted">level session</span>
        </div>

        {/* Full transcript */}
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

        <div className="mt-10 flex gap-3 justify-center">
          <Link href="/session/new" className="btn-accent"><Plus size={16} /> Practice again</Link>
          <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
        </div>
      </main>
    </div>
  );
}
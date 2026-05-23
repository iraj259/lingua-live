"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, LogOut, Clock, MessageSquare, Globe, ChevronRight, TrendingUp } from "lucide-react";
import { sessionsApi, ApiError, type Session } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LANGUAGE_CONFIG, LEVEL_CONFIG, formatDuration, formatDate } from "@/lib/utils";
import { Aurora } from "@/components/aurora";
import Image from "next/image";

function Skeleton() {
  return (
    <div className="glass" style={{ borderRadius: 18, padding: 16, display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ height: 14, background: "rgba(255,255,255,0.06)", borderRadius: 6, width: "60%" }} />
        <div style={{ height: 12, background: "rgba(255,255,255,0.04)", borderRadius: 6, width: "40%" }} />
      </div>
      <div style={{ height: 24, width: 72, background: "rgba(255,255,255,0.06)", borderRadius: 999 }} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: string | number;
}) {
  return (
    <div className="glass" style={{ borderRadius: 18, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.25)",
        display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        <Icon size={14} style={{ color: "var(--violet-2)" }} />
      </div>
      <div>
        <p style={{ fontSize: 20, fontWeight: 600, color: "#fff", lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>{label}</p>
      </div>
    </div>
  );
}

function LanguageBar({ sessions }: { sessions: Session[] }) {
  const counts: Record<string, number> = {};
  for (const s of sessions) {
    counts[s.language] = (counts[s.language] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 4);

  return (
    <div className="glass" style={{ borderRadius: 18, padding: 20 }}>
      <h3 className="section-label mb-4">Languages practiced</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map(([lang, count]) => {
          const cfg = LANGUAGE_CONFIG[lang as keyof typeof LANGUAGE_CONFIG];
          const pct = Math.round((count / sessions.length) * 100);
          return (
            <div key={lang} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20, width: 24, flexShrink: 0 }}>{cfg?.flag ?? "🌐"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#fff" }}>{cfg?.label ?? lang}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>{count} session{count !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--violet-2), var(--magenta))", borderRadius: 999, transition: "width .5s ease" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStreak(sessions: Session[]): number {
  if (!sessions.length) return 0;
  const days = new Set(sessions.map(s => new Date(s.startedAt).toDateString()));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (days.has(d.toDateString())) streak++;
    else break;
  }
  return streak;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, isLoading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    sessionsApi.list({ limit: 20 })
      .then(({ sessions: data }) => setSessions(data))
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) logout();
        else setError("Failed to load sessions.");
      })
      .finally(() => setLoading(false));
  }, [user, logout]);

  if (authLoading || !user) return null;

  const completed   = sessions.filter(s => s.status === "completed");
  const totalMins   = Math.floor(completed.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0) / 60);
  const uniqueLangs = new Set(sessions.map(s => s.language)).size;
  const streak      = getStreak(sessions);

  return (
    <div style={{ minHeight: "100dvh", position: "relative" }}>
      <Aurora intensity={0.6} />
      <div className="grain" />

      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Header */}
        <header style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 10,
          background: "rgba(5,2,8,0.6)",
        }}>
          <div style={{ maxWidth: 768, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Lingua Live"
                width={34}
                height={34}
                style={{ borderRadius: 9, filter: "drop-shadow(0 0 10px rgba(168,85,247,0.8))" }}
              />
              <span className="wordmark text-white" style={{ fontSize: 15 }}>lingua·live</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span className="hidden sm:block text-[13px]" style={{ color: "var(--ink-dim)" }}>{user.displayName}</span>
              <button onClick={logout} className="btn-ghost" style={{ padding: "8px 14px", fontSize: 12 }}>
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 768, margin: "0 auto", padding: "32px 24px" }}>

          {/* Welcome */}
          <div className="flex items-start justify-between gap-3" style={{ marginBottom: 32 }}>
            <div style={{ minWidth: 0 }}>
              <h1 className="font-display text-white" style={{ fontSize: "clamp(22px, 6vw, 28px)", fontWeight: 400, letterSpacing: "-0.01em" }}>
                Hey, {user.displayName.split(" ")[0]} 👋
              </h1>
              <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 4 }}>
                {sessions.length === 0
                  ? "Start your first conversation below."
                  : `${sessions.length} practice session${sessions.length === 1 ? "" : "s"} total.`}
              </p>
            </div>
            <Link href="/session/new" className="btn-violet" style={{ padding: "10px 16px", fontSize: 12, flexShrink: 0 }}>
              <Plus size={14} /> New
            </Link>
          </div>

          {/* Stats */}
          {sessions.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 12, marginBottom: 20 }}>
              <StatCard icon={MessageSquare} label="Sessions"      value={sessions.length} />
              <StatCard icon={Clock}         label="Min practiced" value={totalMins} />
              <StatCard icon={Globe}         label="Languages"     value={uniqueLangs} />
              <StatCard icon={TrendingUp}    label="Day streak"    value={streak} />
            </div>
          )}

          {/* Language breakdown */}
          {sessions.length > 2 && (
            <div style={{ marginBottom: 24 }}>
              <LanguageBar sessions={sessions} />
            </div>
          )}

          {/* Session list */}
          <h2 className="section-label mb-3">Recent sessions</h2>

          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: 12, marginBottom: 16,
              background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)",
              color: "#fca5a5", fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3].map(i => <Skeleton key={i} />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="glass" style={{ borderRadius: 24, padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🗣️</div>
              <h3 className="font-display text-white" style={{ fontSize: 18, fontWeight: 400, marginBottom: 8 }}>No sessions yet</h3>
              <p style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 24, maxWidth: 280, margin: "0 auto 24px" }}>
                Start a conversation with your AI tutor. Pick a language and begin — no preparation needed.
              </p>
              <Link href="/session/new" className="btn-violet" style={{ padding: "14px 24px", fontSize: 13 }}>
                <Plus size={15} /> Start your first session
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }} className="animate-fade-in">
              {sessions.map(s => {
                const lang  = LANGUAGE_CONFIG[s.language as keyof typeof LANGUAGE_CONFIG];
                const level = LEVEL_CONFIG[s.level as keyof typeof LEVEL_CONFIG];
                return (
                  <Link
                    key={s.id}
                    href={`/session/${s.id}/summary`}
                    className="glass"
                    style={{
                      borderRadius: 18, padding: 16, display: "flex", alignItems: "center", gap: 16,
                      textDecoration: "none", transition: "border-color .2s, box-shadow .2s",
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      display: "grid", placeItems: "center", fontSize: 22, flexShrink: 0,
                    }}>
                      {lang?.flag ?? "🌐"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.title ?? `${lang?.label ?? s.language} session`}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                        <span style={{ fontSize: 11.5, color: "var(--ink-dim)" }}>{formatDate(s.startedAt)}</span>
                        {s.durationSeconds && (
                          <>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>·</span>
                            <span style={{ fontSize: 11.5, color: "var(--ink-dim)" }}>{formatDuration(s.durationSeconds)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {level && (
                        <span className="badge" style={{
                          fontSize: 10, padding: "3px 10px",
                          background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)",
                          color: "#e9d5ff",
                        }}>
                          {level.label}
                        </span>
                      )}
                      <ChevronRight size={14} style={{ color: "var(--ink-mute)" }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

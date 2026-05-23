"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { sessionsApi, ApiError, type Language, type Level } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LANGUAGE_CONFIG, LEVEL_CONFIG } from "@/lib/utils";
import { Aurora } from "@/components/aurora";

const SCENARIOS = [
  { id: "cafe",       icon: "☕", title: "Order at a café",       sub: "Pastries, coffee, small talk" },
  { id: "hotel",      icon: "🏨", title: "Check into a hotel",    sub: "Reservation, room, amenities" },
  { id: "interview",  icon: "💼", title: "Job interview",         sub: "Background, strengths, questions" },
  { id: "doctor",     icon: "🩺", title: "See a doctor",          sub: "Symptoms, prescriptions, advice" },
  { id: "market",     icon: "🛒", title: "Shop at a market",      sub: "Prices, haggling, descriptions" },
  { id: "directions", icon: "🗺️", title: "Ask for directions",    sub: "Streets, transit, landmarks" },
  { id: "first-date", icon: "🌹", title: "First date",            sub: "Hobbies, plans, charm" },
  { id: "custom",     icon: "✏️", title: "Describe your own",     sub: "Any scenario you want" },
];

const LEVELS: { id: Level; label: string; d: string }[] = [
  { id: "beginner",     label: "Beginner",     d: "Simple sentences, common vocab" },
  { id: "intermediate", label: "Intermediate", d: "Natural grammar, some idioms" },
  { id: "advanced",     label: "Advanced",     d: "Native speed, idiomatic" },
];

function SelectCard({
  selected, onClick, children, pad,
}: {
  selected: boolean; onClick: () => void; children: React.ReactNode; pad?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        borderRadius: 18, padding: pad ? 18 : "20px 16px",
        cursor: "pointer", textAlign: "left", width: "100%", border: "none",
        background: selected
          ? "linear-gradient(160deg, rgba(168,85,247,0.18), rgba(124,58,237,0.08) 60%, rgba(255,255,255,0.04))"
          : "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02) 40%, rgba(124,58,237,0.04))",
        borderColor: selected ? "rgba(192,132,252,0.7)" : "rgba(255,255,255,0.15)",
        boxShadow: selected
          ? "0 0 0 1px rgba(192,132,252,0.7), 0 14px 40px -10px rgba(168,85,247,0.4), inset 0 1px 0 rgba(255,255,255,0.12)"
          : "inset 0 1px 0 rgba(255,255,255,0.08)",
        outline: selected ? "1px solid rgba(192,132,252,0.7)" : "1px solid rgba(255,255,255,0.15)",
        transform: selected ? "translateY(-1px)" : "translateY(0)",
        transition: "all .2s",
      }}
    >
      {children}
    </button>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
        <span className="step-badge">{n}</span>
        <h3 className="font-display text-white" style={{ fontSize: 22, fontWeight: 400, letterSpacing: "-0.01em" }}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function NewSessionPage() {
  const router = useRouter();
  const { user, logout, isLoading: authLoading } = useAuth();

  const [language,    setLanguage]    = useState<Language>("spanish");
  const [level,       setLevel]       = useState<Level>("beginner");
  const [scenarioId,  setScenarioId]  = useState("cafe");
  const [custom,      setCustom]      = useState("");
  const [creating,    setCreating]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  const scenarioTitle = scenarioId === "custom" ? custom.trim() : SCENARIOS.find(s => s.id === scenarioId)?.title ?? scenarioId;
  const canStart = scenarioId !== "custom" || custom.trim().length >= 5;

  async function handleStart() {
    if (!canStart) return;
    setCreating(true);
    setError(null);
    try {
      const { session } = await sessionsApi.create({ language, level });
      router.push(`/session/${session.id}?scenario=${encodeURIComponent(scenarioTitle)}&language=${language}&level=${level}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else { setError("Failed to create session."); setCreating(false); }
    }
  }

  const langs = Object.entries(LANGUAGE_CONFIG) as [Language, typeof LANGUAGE_CONFIG[Language]][];
  const selectedLang  = LANGUAGE_CONFIG[language];
  const selectedLevel = LEVELS.find(l => l.id === level);

  return (
    <div style={{ position: "relative", minHeight: "100dvh" }}>
      <Aurora intensity={0.65} />
      <div className="grain" />

      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Nav */}
        <nav className="px-6 lg:px-12 py-5 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <Link href="/dashboard" className="flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-dim)", textDecoration: "none" }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>←</span> Dashboard
          </Link>
          <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>Hi, {user.displayName.split(" ")[0]}</span>
        </nav>

        <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>

          {/* Header */}
          <div style={{ marginBottom: 48 }}>
            <span className="pill mb-5 inline-flex"><span>New session</span></span>
            <h1 className="font-display text-white" style={{ fontSize: "clamp(32px, 5vw, 60px)", fontWeight: 300, lineHeight: 1.0, letterSpacing: "-0.02em" }}>
              What do you want to <span className="font-serif-i" style={{ color: "#c084fc" }}>practice</span> today?
            </h1>
          </div>

          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: 12, marginBottom: 24,
              background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)",
              color: "#fca5a5", fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Step 1 — Language */}
          <Step n="01" title="Pick a language">
            <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 10 }}>
              {langs.map(([key, cfg]) => (
                <SelectCard key={key} selected={language === key} onClick={() => setLanguage(key)}>
                  <div style={{ fontSize: 30 }}>{cfg.flag}</div>
                  <div style={{ marginTop: 8, fontSize: 14, color: "#fff" }}>{cfg.label}</div>
                  <div className="font-serif-i" style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>{cfg.nativeName}</div>
                </SelectCard>
              ))}
            </div>
          </Step>

          {/* Step 2 — Level */}
          <Step n="02" title="Choose your level">
            <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 10 }}>
              {LEVELS.map(l => (
                <SelectCard key={l.id} selected={level === l.id} onClick={() => setLevel(l.id)} pad>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 15, color: "#fff" }}>{l.label}</span>
                    {level === l.id && <span className="step-badge">SELECTED</span>}
                  </div>
                  <p style={{ fontSize: 12.5, marginTop: 6, color: "var(--ink-dim)", lineHeight: 1.5 }}>{l.d}</p>
                </SelectCard>
              ))}
            </div>
          </Step>

          {/* Step 3 — Scenario */}
          <Step n="03" title="Pick a scenario">
            <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 10 }}>
              {SCENARIOS.map(s => (
                <SelectCard key={s.id} selected={scenarioId === s.id} onClick={() => { setScenarioId(s.id); setCustom(""); }} pad>
                  <div style={{ fontSize: 24 }}>{s.icon}</div>
                  <div style={{ marginTop: 8, fontSize: 14, color: "#fff" }}>{s.title}</div>
                  <div style={{ fontSize: 12, marginTop: 3, color: "var(--ink-dim)" }}>{s.sub}</div>
                </SelectCard>
              ))}
            </div>

            {scenarioId === "custom" && (
              <div style={{ marginTop: 16 }}>
                <div className="step-badge mb-2 block">DESCRIBE YOUR SCENARIO</div>
                <textarea
                  className="glass-input"
                  placeholder='e.g. "Returning a phone at an Apple store in Tokyo"'
                  value={custom}
                  onChange={e => setCustom(e.target.value)}
                  rows={3}
                  style={{ resize: "none", fontSize: 14 }}
                />
              </div>
            )}
          </Step>

          {/* Summary + start */}
          <div className="glass flex flex-col sm:flex-row sm:items-center flex-wrap gap-4" style={{ borderRadius: 24, padding: 24 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="step-badge mb-2">YOUR SESSION</div>
              <div style={{ fontSize: 15, color: "#fff", lineHeight: 1.4 }}>
                {scenarioTitle}{" "}
                <span style={{ color: "var(--ink-dim)" }}>·</span>{" "}
                <span>{selectedLang?.flag} {selectedLang?.label}</span>{" "}
                <span style={{ color: "var(--ink-dim)" }}>·</span>{" "}
                <span style={{ color: "var(--ink-dim)" }}>{selectedLevel?.label}</span>
              </div>
            </div>
            <button
              onClick={handleStart}
              disabled={creating || !canStart}
              className="btn-violet w-full sm:w-auto"
              style={{ padding: "16px 26px", fontSize: 14, opacity: (creating || !canStart) ? 0.5 : 1 }}
            >
              {creating
                ? <><Loader2 size={16} className="animate-spin" /> Starting…</>
                : "Start session →"
              }
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

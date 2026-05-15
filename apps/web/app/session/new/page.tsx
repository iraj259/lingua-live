"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { sessionsApi, ApiError, type Language, type Level } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LANGUAGE_CONFIG, LEVEL_CONFIG, cn } from "@/lib/utils";

const SCENARIOS = [
  { id: "cafe",       icon: "☕", label: "Café",         hint: "Order coffee, ask for the menu, pay the bill" },
  { id: "market",     icon: "🛒", label: "Market",       hint: "Browse stalls, ask prices, negotiate" },
  { id: "directions", icon: "🗺️", label: "Directions",   hint: "Ask how to get somewhere, understand routes" },
  { id: "restaurant", icon: "🍽️", label: "Restaurant",   hint: "Book a table, order food, deal with issues" },
  { id: "hotel",      icon: "🏨", label: "Hotel",        hint: "Check in, ask for amenities, report a problem" },
  { id: "transport",  icon: "🚕", label: "Transport",    hint: "Hail a cab, buy tickets, ask about trains" },
  { id: "doctor",     icon: "🏥", label: "Doctor",       hint: "Describe symptoms, understand advice" },
  { id: "custom",     icon: "✏️", label: "Custom",       hint: "Describe your own scenario" },
];

export default function NewSessionPage() {
  const router = useRouter();
  const { user, logout, isLoading: authLoading } = useAuth();
  const [language, setLanguage]     = useState<Language>("spanish");
  const [level, setLevel]           = useState<Level>("beginner");
  const [scenarioId, setScenarioId] = useState("cafe");
  const [custom, setCustom]         = useState("");
  const [creating, setCreating]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => { if (!authLoading && !user) router.replace("/login"); }, [authLoading, user, router]);
  if (authLoading || !user) return null;

  const canStart = scenarioId !== "custom" || custom.trim().length >= 10;

  async function handleStart() {
    if (!canStart) return;
    setCreating(true);
    setError(null);
    try {
      const { session } = await sessionsApi.create({ language, level });
      const scenarioParam = encodeURIComponent(
        scenarioId === "custom"
          ? custom.trim()
          : SCENARIOS.find(s => s.id === scenarioId)?.hint ?? scenarioId
      );
      router.push(`/session/${session.id}?scenario=${scenarioParam}&language=${language}&level=${level}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else { setError("Failed to create session."); setCreating(false); }
    }
  }

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-border bg-white">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="btn-ghost p-2 -ml-2"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-base font-semibold text-ink">New session</h1>
            <p className="text-xs text-muted">Configure your practice session</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-danger">{error}</div>}

        {/* Language */}
        <section>
          <p className="section-label mb-3">Language to practice</p>
          <div className="grid grid-cols-4 gap-2">
            {(Object.entries(LANGUAGE_CONFIG) as [Language, typeof LANGUAGE_CONFIG[Language]][]).map(([key, cfg]) => (
              <button key={key} onClick={() => setLanguage(key)}
                className={cn("flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all",
                  language === key
                    ? "border-accent bg-accent-soft ring-1 ring-accent/30"
                    : "bg-white border-border hover:border-accent/40")}>
                <span className="text-2xl">{cfg.flag}</span>
                <span className="text-xs font-medium text-ink">{cfg.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Level */}
        <section>
          <p className="section-label mb-3">Your level</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(LEVEL_CONFIG) as [Level, typeof LEVEL_CONFIG[Level]][]).map(([key, cfg]) => (
              <button key={key} onClick={() => setLevel(key)}
                className={cn("py-3 px-4 rounded-xl border text-left transition-all",
                  level === key
                    ? "border-accent bg-accent-soft ring-1 ring-accent/30"
                    : "bg-white border-border hover:border-accent/40")}>
                <p className="text-sm font-medium text-ink">{cfg.label}</p>
                <p className="text-xs text-muted mt-0.5 leading-snug">{cfg.description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Scenario */}
        <section>
          <p className="section-label mb-3">Scenario</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {SCENARIOS.map(s => (
              <button key={s.id} onClick={() => setScenarioId(s.id)}
                className={cn("flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                  scenarioId === s.id
                    ? "border-accent bg-accent-soft ring-1 ring-accent/30"
                    : "bg-white border-border hover:border-accent/40")}>
                <span className="text-lg mt-0.5">{s.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-ink">{s.label}</p>
                  <p className="text-[11px] text-muted mt-0.5 leading-snug">{s.hint}</p>
                </div>
              </button>
            ))}
          </div>
          {scenarioId === "custom" && (
            <textarea value={custom} onChange={e => setCustom(e.target.value)} rows={3}
              placeholder="Describe your scenario... e.g. 'I'm meeting my French business partner for the first time'"
              className="input resize-none text-sm" />
          )}
        </section>

        <button onClick={handleStart} disabled={creating || !canStart}
          className={cn("btn-primary w-full py-4 text-base", (!canStart || creating) && "opacity-60")}>
          {creating
            ? <><Loader2 size={18} className="animate-spin" /> Starting…</>
            : <>Start practicing {LANGUAGE_CONFIG[language]?.flag}</>}
        </button>
      </main>
    </div>
  );
}
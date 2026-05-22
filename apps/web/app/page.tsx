import Link from "next/link";
import Image from "next/image";
import { Aurora } from "@/components/aurora";
import { LANGUAGE_CONFIG } from "@/lib/utils";

const STEPS = [
  {
    n: "01",
    t: "Describe the moment",
    d: '"Ordering coffee in Lisbon." "A job interview in Tokyo." One sentence. The AI builds the whole scene.',
  },
  {
    n: "02",
    t: "Talk, don't type",
    d: "Hold the mic. Speak. The tutor listens, responds out loud, and stays in character — even when you fumble.",
  },
  {
    n: "03",
    t: "Get caught on the way out",
    d: "After every session, a quiet recap: what you nailed, what tripped you, the words to keep practicing.",
  },
];

export default function LandingPage() {
  const langs = Object.entries(LANGUAGE_CONFIG);

  return (
    <div style={{ position: "relative", minHeight: "100dvh" }}>
      <Aurora intensity={1} />
      <div className="grain" />

      <div style={{ position: "relative", zIndex: 2 }}>

        {/* ── Nav ──────────────────────────────────────────────────────── */}
        <nav className="flex items-center justify-between px-8 lg:px-16 py-6">
          <Wordmark />
          <div className="hidden md:flex items-center gap-9 text-[13px]" style={{ color: "var(--ink-dim)" }}>
            <a className="hover:text-white transition-colors" href="#how">How it works</a>
            <a className="hover:text-white transition-colors" href="#languages">Languages</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost text-[13px]" style={{ padding: "10px 18px" }}>Sign in</Link>
            <Link href="/register" className="btn-violet text-[13px]" style={{ padding: "10px 18px" }}>Get started</Link>
          </div>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="px-6 lg:px-16 pt-20 lg:pt-28 pb-32 text-center">
          <div className="max-w-5xl mx-auto">
            <span className="pill mb-10 inline-flex">
              <span className="dot" />
              <span>Live AI voice tutor · Now open</span>
            </span>

            <h1 className="font-display text-white" style={{
              fontSize: "clamp(48px, 8.5vw, 130px)",
              fontWeight: 300,
              lineHeight: 0.96,
              letterSpacing: "-0.02em",
            }}>
              Speak any language
              <br />
              <span className="font-serif-i" style={{
                fontWeight: 400,
                background: "linear-gradient(120deg, #fff 10%, #c084fc 50%, #f472b6 90%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                letterSpacing: "0",
              }}>
                like you were born to.
              </span>
            </h1>

            <p className="mx-auto mt-10 max-w-xl" style={{
              color: "var(--ink-dim)", fontSize: 17, lineHeight: 1.55, fontWeight: 300,
            }}>
              Lingua Live drops you into real-world roleplays and coaches you through them
              in real time — voice-first, without ever breaking the flow.
            </p>

            <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register" className="btn-violet" style={{ padding: "16px 28px", fontSize: 14 }}>
                Begin your first session →
              </Link>
              <Link href="/login?demo=true" className="btn-ghost" style={{ padding: "15px 28px", fontSize: 14 }}>
                Try demo account
              </Link>
            </div>

            <p className="mt-5 text-[12px]" style={{ color: "var(--ink-mute)" }}>
              Free to start · No credit card · 8 languages · 3 levels
            </p>
          </div>
        </section>

        {/* ── Languages marquee ─────────────────────────────────────────── */}
        <section id="languages" className="overflow-hidden py-10 border-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="marquee-track flex gap-12 whitespace-nowrap font-display" style={{ fontSize: 28, fontWeight: 300, color: "rgba(237,228,255,0.55)", letterSpacing: "-0.01em" }}>
            {[...langs, ...langs, ...langs].map(([key, cfg], i) => (
              <span key={`${key}-${i}`} className="inline-flex items-center gap-3">
                <span style={{ fontSize: 26 }}>{cfg.flag}</span>
                <span>{cfg.label}</span>
                <span className="font-serif-i" style={{ color: "rgba(168,85,247,0.7)", marginLeft: 6 }}>{cfg.nativeName}</span>
                <span style={{ color: "rgba(255,255,255,0.15)", margin: "0 12px" }}>✦</span>
              </span>
            ))}
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────── */}
        <section id="how" className="px-6 lg:px-16 py-32">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between flex-wrap gap-6 mb-16">
              <div>
                <span className="pill mb-5 inline-flex"><span>Three steps</span></span>
                <h2 className="font-display text-white max-w-xl" style={{ fontSize: "clamp(36px, 5vw, 68px)", fontWeight: 300, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
                  A new way to <span className="font-serif-i" style={{ color: "#c084fc" }}>practice</span>.
                </h2>
              </div>
              <p className="max-w-md text-[15px]" style={{ color: "var(--ink-dim)", lineHeight: 1.6 }}>
                No flashcards. No grammar drills. Just real conversations, shaped to your level, generated on demand.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {STEPS.map(step => (
                <div key={step.n} className="glass" style={{ borderRadius: 24, padding: 28, minHeight: 260 }}>
                  <div className="flex items-start justify-between mb-8">
                    <span className="step-badge">{step.n}</span>
                    <span className="font-mono text-[11px]" style={{ color: "var(--ink-mute)" }}>STEP</span>
                  </div>
                  <h3 className="font-display text-white" style={{ fontSize: 22, fontWeight: 400, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                    {step.t}
                  </h3>
                  <p className="mt-4 text-[14px]" style={{ color: "var(--ink-dim)", lineHeight: 1.6 }}>
                    {step.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Language grid ─────────────────────────────────────────────── */}
        <section className="px-6 lg:px-16 py-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <span className="pill mb-5 inline-flex"><span>Eight languages</span></span>
              <h2 className="font-display text-white" style={{ fontSize: "clamp(32px, 4.4vw, 56px)", fontWeight: 300, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
                Pick where you&apos;re <span className="font-serif-i" style={{ color: "#c084fc" }}>going</span>.
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {langs.map(([key, cfg]) => (
                <div key={key} className="glass" style={{
                  borderRadius: 18, padding: 22,
                  transition: "transform .2s, border-color .2s", cursor: "pointer",
                }}>
                  <div style={{ fontSize: 34 }}>{cfg.flag}</div>
                  <div className="mt-3 text-white text-[15px]">{cfg.label}</div>
                  <div className="font-serif-i text-[14px]" style={{ color: "var(--ink-dim)" }}>{cfg.nativeName}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section className="px-6 lg:px-16 py-32 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-white" style={{ fontSize: "clamp(40px, 7vw, 96px)", fontWeight: 300, lineHeight: 0.98, letterSpacing: "-0.02em" }}>
              Your <span className="font-serif-i" style={{ color: "#c084fc" }}>first</span> conversation
              <br /> is one tap away.
            </h2>
            <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register" className="btn-violet" style={{ padding: "16px 28px", fontSize: 14 }}>
                Create your account →
              </Link>
              <Link href="/login" className="btn-ghost" style={{ padding: "15px 28px", fontSize: 14 }}>
                I already have one
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer className="px-8 lg:px-16 py-12 border-t flex flex-wrap items-center justify-between gap-6"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <Wordmark small />
          <div className="font-mono text-[11px] flex gap-6" style={{ color: "var(--ink-mute)" }}>
            <span>v0.5 · Phase 5</span>
            <span>Made with Groq · Bun · Next.js</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Wordmark({ small }: { small?: boolean }) {
  const logoSize = small ? 24 : 32;
  const fontSize = small ? 13 : 16;
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/logo.png"
        alt="Lingua Live"
        width={logoSize}
        height={logoSize}
        style={{ borderRadius: small ? 7 : 9, filter: "drop-shadow(0 0 8px rgba(168,85,247,0.8))" }}
      />
      <span className="wordmark text-white" style={{ fontSize }}>
        lingua<span style={{ color: "rgba(192,132,252,0.85)" }}>·</span>live
      </span>
    </div>
  );
}

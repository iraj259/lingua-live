"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { authApi, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Aurora } from "@/components/aurora";
import Image from "next/image";

export default function RegisterPage() {
  const router = useRouter();
  const { login, user } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => { if (user) router.replace("/dashboard"); }, [user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError(null);
    setLoading(true);
    try {
      const { token, user: u } = await authApi.register({ email, password, displayName });
      login(token, u);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "relative", minHeight: "100dvh" }} className="flex flex-col">
      <Aurora intensity={1} />
      <div className="grain" />

      <div style={{ position: "relative", zIndex: 2 }} className="flex flex-col min-h-dvh">
        {/* Top nav */}
        <nav className="flex items-center justify-between px-6 lg:px-12 py-6">
          <Link href="/" className="flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-dim)" }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>←</span> Back home
          </Link>
          <Link href="/login" className="text-[12px]" style={{ color: "var(--ink-dim)" }}>
            Have an account?{" "}
            <span className="text-white" style={{ textDecoration: "underline", textUnderlineOffset: 4 }}>Sign in</span>
          </Link>
        </nav>

        {/* Card */}
        <div className="flex-1 flex items-center justify-center px-5 py-10">
          <div className="glass" style={{ width: "100%", maxWidth: 420, borderRadius: 32, padding: "44px 32px 36px" }}>

            <div className="text-center">
              <Image
                src="/logo.png"
                alt="Lingua Live"
                width={60}
                height={60}
                style={{ borderRadius: 16, filter: "drop-shadow(0 0 14px rgba(168,85,247,0.8))", margin: "0 auto 12px" }}
              />
              <h1 className="wordmark text-white" style={{
                fontSize: 26,
                background: "linear-gradient(180deg, #fff 30%, rgba(192,132,252,0.45) 130%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                lingua·live
              </h1>
              <h2 className="font-display text-white mt-7" style={{ fontSize: 30, fontWeight: 300, letterSpacing: "-0.01em" }}>
                Start speaking
              </h2>
              <p className="mt-2 text-[13px]" style={{ color: "var(--ink-dim)" }}>
                Two minutes to your first conversation.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5">
              {error && (
                <div style={{
                  padding: "12px 16px", borderRadius: 12,
                  background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)",
                  color: "#fca5a5", fontSize: 13,
                }}>
                  {error}
                </div>
              )}

              <Field label="Name">
                <input
                  className="input"
                  type="text"
                  placeholder="What should we call you?"
                  value={displayName}
                  onChange={e => { setDisplayName(e.target.value); setError(null); }}
                  required
                  minLength={2}
                  maxLength={50}
                  autoComplete="name"
                />
              </Field>

              <Field label="Email address">
                <input
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  required
                  autoComplete="email"
                />
              </Field>

              <Field label="Password">
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showPw ? "text" : "password"}
                    placeholder="Choose something memorable (min 8)"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    style={{ paddingRight: 52 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{
                      position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                      background: "transparent", border: "none", color: "var(--ink-dim)",
                      fontSize: 12, padding: "4px 8px", cursor: "pointer",
                    }}
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </Field>

              <button
                type="submit"
                disabled={loading}
                className="btn-violet w-full"
                style={{ padding: "16px 22px", fontSize: 15, marginTop: 4 }}
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Creating…</>
                  : "Create account"
                }
              </button>
            </form>

            <p className="text-center text-[12.5px] mt-7" style={{ color: "var(--ink-dim)" }}>
              Already have an account?{" "}
              <Link href="/login" className="text-white font-medium" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center pb-8 text-[11px]" style={{ color: "var(--ink-mute)" }}>
          Free forever · No credit card required
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[13px]" style={{ color: "var(--ink-dim)" }}>{label}</div>
      {children}
    </div>
  );
}

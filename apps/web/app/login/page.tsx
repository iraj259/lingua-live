"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authApi, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, user } = useAuth();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => { if (user) router.replace("/dashboard"); }, [user, router]);

  useEffect(() => {
    if (params.get("demo") === "true") {
      setEmail("demo@lingua-ai.com");
      setPassword("demo1234");
    }
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user: u } = await authApi.login({ email, password });
      login(token, u);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
              <span className="text-paper text-sm font-bold">L</span>
            </div>
          </Link>
          <h1 className="text-2xl font-semibold text-ink mb-1">Welcome back</h1>
          <p className="text-sm text-muted">Sign in to continue practicing</p>
        </div>

        {params.get("demo") === "true" && (
          <div className="mb-4 p-3 rounded-xl bg-accent-soft border border-accent/20 text-xs text-accent text-center">
            Demo credentials filled in — click Sign in to explore
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-danger">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-ink mb-1.5" htmlFor="email">Email</label>
            <input id="email" type="email" value={email} required autoComplete="email"
              onChange={e => { setEmail(e.target.value); setError(null); }}
              placeholder="you@example.com" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1.5" htmlFor="pw">Password</label>
            <div className="relative">
              <input id="pw" type={showPw ? "text" : "password"} value={password} required
                onChange={e => { setPassword(e.target.value); setError(null); }}
                placeholder="••••••••" className="input pr-11" autoComplete="current-password" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className={cn("btn-primary w-full py-3", loading && "opacity-70")}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-4">
          No account?{" "}
          <Link href="/register" className="text-accent font-medium hover:underline">Register free</Link>
        </p>
      </div>
    </div>
  );
}
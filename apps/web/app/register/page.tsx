"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authApi, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

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
    <div className="min-h-dvh flex items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
              <span className="text-paper text-sm font-bold">L</span>
            </div>
          </Link>
          <h1 className="text-2xl font-semibold text-ink mb-1">Create your account</h1>
          <p className="text-sm text-muted">Free forever. No credit card required.</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-danger">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-ink mb-1.5">Your name</label>
            <input type="text" value={displayName} required minLength={2} maxLength={50}
              onChange={e => { setDisplayName(e.target.value); setError(null); }}
              placeholder="Alex" className="input" autoComplete="name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1.5">Email</label>
            <input type="email" value={email} required
              onChange={e => { setEmail(e.target.value); setError(null); }}
              placeholder="you@example.com" className="input" autoComplete="email" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1.5">Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={password} required minLength={8}
                onChange={e => { setPassword(e.target.value); setError(null); }}
                placeholder="Min 8 characters" className="input pr-11" autoComplete="new-password" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className={cn("btn-primary w-full py-3", loading && "opacity-70")}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-accent font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
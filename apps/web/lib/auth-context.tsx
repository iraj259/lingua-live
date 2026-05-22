"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authApi, type User } from "@/lib/api";

interface AuthCtx {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

function jwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser]           = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const token  = localStorage.getItem("token");
      const stored = localStorage.getItem("user");

      if (!token) { setIsLoading(false); return; }

      // Reject expired tokens immediately — no API call needed
      if (jwtExpired(token)) {
        clearAuth();
        setIsLoading(false);
        return;
      }

      // Optimistically restore from localStorage (instant UI)
      if (stored) {
        try { setUser(JSON.parse(stored) as User); } catch { /* ignore */ }
      }

      // Validate with server to catch revoked / tampered tokens
      try {
        const { user: validated } = await authApi.me();
        setUser(validated);
        localStorage.setItem("user", JSON.stringify(validated));
      } catch {
        clearAuth();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    void init();
  }, []);

  const login = useCallback((token: string, u: User) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
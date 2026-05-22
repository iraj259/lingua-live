const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

// ── Types ──────────────────────────────────────────────────────────────────
export type Language = "spanish"|"french"|"german"|"italian"|"japanese"|"mandarin"|"portuguese"|"arabic";
export type Level    = "beginner"|"intermediate"|"advanced";

export interface User    { id: string; email: string; displayName: string; createdAt: string; }
export interface Session {
  id:              string;
  userId:          string;
  language:        Language;
  level:           Level;
  status:          "active" | "completed" | "abandoned";
  title:           string | null;
  scenarioContext: Record<string, unknown> | null;   // ← add this line
  startedAt:       string;
  endedAt:         string | null;
  durationSeconds: number | null;
}
export interface Message { id: string; sessionId: string; role: "user"|"assistant"; content: string; createdAt: string; }
export interface AuthResponse { token: string; user: User; }

export class ApiError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Core fetch ─────────────────────────────────────────────────────────────
async function request<T>(path: string, options: { body?: unknown; method?: string; token?: string } = {}): Promise<T> {
  const { body, method = "GET", token } = options;
  const authToken = token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json().catch(() => ({ error: "Invalid response", code: "PARSE_ERROR" }));
  if (!res.ok) throw new ApiError((data as any).error ?? "Request failed", (data as any).code ?? "UNKNOWN", res.status);
  return data as T;
}

// ── API methods ────────────────────────────────────────────────────────────
export const authApi = {
  register: (d: { email: string; password: string; displayName: string }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: d }),
  login: (d: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: d }),
  me: () => request<{ user: User }>("/auth/me"),
};

export const sessionsApi = {
  create: (d: { language: Language; level: Level }) =>
    request<{ session: Session }>("/sessions", { method: "POST", body: d }),
  list: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit)  qs.set("limit",  String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    return request<{ sessions: Session[]; pagination: { total: number; hasMore: boolean } }>(
      `/sessions${qs.toString() ? `?${qs}` : ""}`
    );
  },
  get: (id: string) => request<{ session: Session; messages: Message[] }>(`/sessions/${id}`),
  end: (id: string, title?: string) =>
    request<{ session: Session }>(`/sessions/${id}/end`, { method: "PATCH", body: { title } }),
};

export const chatApi = {
  send: (sessionId: string, message: string) =>
    request<{ userMessage: Message; aiMessage: Message }>("/chat", { method: "POST", body: { sessionId, message } }),
  translate: (text: string, fromLanguage: string) =>
    request<{ translation: string }>("/chat/translate", { method: "POST", body: { text, fromLanguage } }),
  suggest: (aiMessage: string, language: string, level: string) =>
    request<{ suggestions: { reply: string; english: string }[] }>("/chat/suggest", {
      method: "POST", body: { aiMessage, language, level },
    }),
};

export interface Correction {
  original:    string;
  corrected:   string;
  explanation: string;
  type:        "grammar" | "vocabulary" | "syntax" | "spelling";
}

export interface FeedbackReport {
  id:           string;
  sessionId:    string;
  grammarScore: number;
  fluencyScore: number;
  vocabScore:   number;
  corrections:  Correction[];
  suggestions:  string[];
  strengths:    string[];
  weaknessTags: string[];
  createdAt:    string;
}

export const feedbackApi = {
  get: (sessionId: string) =>
    request<{ pending: boolean; report?: FeedbackReport }>(`/feedback/${sessionId}`),
};
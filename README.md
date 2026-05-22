# LinguaAI — AI Language Practice Platform

> Practice real conversations with an AI tutor. Speak or type. Get instant feedback. No judgment — just progress.

**Demo login:** `demo@lingua-ai.com` / `demo1234`

---

## What It Does

LinguaAI lets you practice speaking a foreign language with an AI tutor that:
- Plays a realistic character (café barista, hotel receptionist, etc.)
- Speaks back to you in the target language
- Corrects your mistakes naturally without breaking the conversation
- Gives you a detailed feedback report after each session
- Remembers your weaknesses and adapts future sessions

## Tech Stack

| Layer     | Technology                        | Why                                              |
|-----------|-----------------------------------|--------------------------------------------------|
| Frontend  | Next.js 14 + TypeScript           | Industry standard, App Router                    |
| Styling   | Tailwind CSS                      | Fast iteration, consistent design                |
| Backend   | Hono on Bun                       | Fast, typed, lightweight                         |
| Database  | PostgreSQL via Drizzle ORM        | Type-safe, SQL-close, real migrations            |
| AI (LLM)  | Groq API — LLaMA 3.3 70B         | Free tier, ~500 tok/sec streaming                |
| AI (STT)  | Groq Whisper API                  | Same API key, no self-hosting                    |
| TTS       | Web Speech API (browser-native)   | Free, zero latency, language-aware               |
| Auth      | JWT (jose) + bcrypt               | Simple, correct for this scale                   |

## Architecture

```
Browser
  │
  ├── HTTP  → POST /sessions, GET /sessions, /auth/*
  │
  └── WebSocket → /ws
        │
        ├── start_session → ScenarioAgent (Groq) → persona + opening message
        ├── send_message  → ConversationAgent (Groq stream) → token by token
        ├── send_audio    → Whisper API → transcript → ConversationAgent
        └── end_session   → FeedbackAgent (Groq) → scores + corrections
                          → MemoryService → update weakness tags
```

## Key Engineering Decisions

**Why HTTP for sessions, WebSocket for chat?**
Sessions are request/response — HTTP is correct. Chat needs streaming which requires a persistent connection — WebSocket is correct. Using the right tool for each job.

**Why Groq instead of OpenAI?**
Free tier is more generous. Inference is ~8x faster (important for streaming). API is OpenAI-compatible so switching costs zero refactoring.

**Why no agent framework (Mastra, LangChain)?**
Plain TypeScript classes are readable, debuggable, and I can explain every line. Framework abstractions add dependency risk without benefit when you have 3 agents.

**Why Web Speech API for TTS?**
Browser-native, free, zero latency overhead, language-aware. ElevenLabs is a straightforward upgrade path when voice quality becomes a requirement.

## Local Setup

### Prerequisites
- [Bun](https://bun.sh) v1.0+
- [Supabase](https://supabase.com) account (free)
- [Groq](https://console.groq.com) API key (free)

### Steps

```bash
git clone https://github.com/yourusername/lingua-ai
cd lingua-ai
bun install

# Backend env
cp apps/api/.env.example apps/api/.env
# Fill in DATABASE_URL, GROQ_API_KEY, JWT_SECRET

# Frontend env
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > apps/web/.env.local

# Push schema
cd apps/api && bun run db:push

# Seed demo data
bun run db:seed

# Start both servers
cd ../.. && bun run dev
```

Frontend: http://localhost:3000
Backend:  http://localhost:3001/health

## Project Structure

```
lingua-ai/
├── apps/
│   ├── api/                    Hono + Bun backend
│   │   └── src/
│   │       ├── agents/         ScenarioAgent, FeedbackAgent
│   │       ├── services/       MemoryService
│   │       ├── routes/         auth, sessions, feedback
│   │       ├── lib/            groq, stt, ws-session, ws-types
│   │       └── db/             schema, client, seed
│   │
│   └── web/                    Next.js frontend
│       ├── app/                Pages (App Router)
│       └── lib/                api, auth-context, hooks, utils
│
└── README.md
```

## Phases Built

- **Phase 1** — Auth, sessions, REST chat with Groq
- **Phase 2** — WebSocket streaming, ScenarioAgent, optimistic UI
- **Phase 3** — Voice input (Whisper STT) + TTS output
- **Phase 4** — Feedback scores, memory system, adaptive AI
- **Phase 5** — Polish, demo account, documentation

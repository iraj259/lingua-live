# Lingua Live

An AI-powered language tutor that drops you into real-world roleplay scenarios and coaches you through them in real time. Pick a language, pick a level, describe the situation you want to practice — a café order, a hotel check-in, a job interview — and the AI generates a character, setting, and conversation entirely tailored to you.

Built as a multi-phase engineering project demonstrating a production-quality monorepo with WebSocket streaming, AI agents, and a typed full-stack TypeScript codebase.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, TypeScript |
| Backend | Hono on Bun runtime |
| Database | PostgreSQL via Supabase, Drizzle ORM |
| AI | Groq API — LLaMA 3.3 70B (chat), LLaMA 3.1 8B (scenario generation) |
| Real-time | Native Bun WebSocket with SSE token streaming |
| Monorepo | Turborepo with Bun workspaces |
| Deployment | Vercel (web) + Railway (API) |

---

## Features

### Phase 1 — Foundation
- **Auth** — JWT register/login, bcrypt password hashing, protected routes
- **Sessions** — create, list, resume, and end practice sessions
- **8 languages** — Spanish, French, German, Italian, Japanese, Mandarin, Portuguese, Arabic
- **3 levels** — Beginner, Intermediate, Advanced
- **AI chat** — multi-turn conversation with Groq LLaMA 3.3 70B
- **Database** — Drizzle ORM with PostgreSQL enums for type-safe schema

### Phase 2 — Real-time Streaming & AI Agents
- **ScenarioAgent** — generates a unique AI persona (name, role, setting, system prompt, opening message) for every session request
- **WebSocket streaming** — tokens stream word-by-word with a blinking cursor; no waiting for full responses
- **Typed WS protocol** — `ClientMessage` / `ServerMessage` union types shared between client and server
- **Optimistic UI** — user messages appear instantly before server confirmation
- **Reconnect logic** — exponential backoff (up to 5 attempts), intentional-close guard prevents false error states
- **History scoping** — AI context is scoped to the current connection's timestamp, preventing persona leakage across reconnects
- **Session lifecycle** — active → completed / abandoned states tracked in DB with duration

---

## Project Structure

```
lingua-live/
├── apps/
│   ├── api/                    # Hono + Bun backend
│   │   └── src/
│   │       ├── agents/         # AI agents (ScenarioAgent)
│   │       ├── db/             # Drizzle schema, client, seed
│   │       ├── lib/            # groq.ts, ws-session.ts, ws-types.ts, logger, errors
│   │       ├── middleware/     # JWT auth middleware
│   │       ├── routes/         # auth, sessions, chat REST routes
│   │       └── index.ts        # Bun.serve — HTTP + WebSocket upgrade
│   └── web/                    # Next.js 14 App Router frontend
│       ├── app/
│       │   ├── (auth)/         # login, register pages
│       │   ├── dashboard/      # session list + new session form
│       │   └── session/[id]/   # live chat page
│       └── lib/
│           ├── api.ts          # typed REST client
│           └── use-chat-socket.ts  # WebSocket hook with streaming state
└── packages/
    └── tsconfig/               # shared TypeScript base config
```

---

## Architecture

```
Browser
  │
  ├─ REST (HTTP)  ──►  Hono routes  ──►  Drizzle  ──►  PostgreSQL (Supabase)
  │                         │
  └─ WebSocket  ───────►  Bun.serve websocket handler
                               │
                           WSSession (per connection)
                               ├─ start_session  ──►  ScenarioAgent  ──►  Groq LLaMA 3.1 8B
                               └─ send_message   ──►  streamGroqResponse  ──►  Groq LLaMA 3.3 70B
                                                          │
                                                  SSE token stream
                                                          │
                                              { type: "token", token } ──► browser
```

**WebSocket message protocol:**

| Client → Server | Server → Client |
|----------------|-----------------|
| `start_session` | `session_ready` (with scenario) |
| `send_message` | `user_message_saved` |
| `end_session` | `token` (streamed) |
| `ping` | `message_done` |
| | `session_ended` |
| | `pong` |
| | `error` |

---

## Local Setup

### Prerequisites
- [Bun](https://bun.sh) >= 1.1
- [Node.js](https://nodejs.org) >= 20 (for Next.js)
- PostgreSQL database (e.g. free [Supabase](https://supabase.com) project)
- [Groq API key](https://console.groq.com) (free tier available)

### 1. Clone and install

```bash
git clone https://github.com/iraj259/lingua-live.git
cd lingua-live
bun install
```

### 2. Environment variables

**`apps/api/.env`**
```env
DATABASE_URL=postgresql://...        # Supabase connection string
GROQ_API_KEY=gsk_...                 # Groq API key
JWT_SECRET=your-secret-here          # any long random string
FRONTEND_URL=http://localhost:3000
PORT=3001
```

**`apps/web/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Push the database schema

```bash
cd apps/api
bun run db:push
```

### 4. Run both apps

```bash
# From project root
bun run dev
```

- API: http://localhost:3001
- Web: http://localhost:3000

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | Done | Auth, sessions, REST chat with Groq |
| 2 | Done | WebSocket streaming, ScenarioAgent, optimistic UI |
| 3 | Planned | FeedbackAgent — real-time grammar correction per message |
| 4 | Planned | VoiceAgent — Whisper STT + TTS for spoken practice |
| 5 | Planned | ProgressAgent — tracks vocabulary and grammar patterns over time |
| 6 | Planned | Multi-agent orchestration with BaseAgent, shared message bus |
| 7 | Planned | Analytics dashboard, streak tracking, spaced repetition |
| 8 | Planned | Mobile app (React Native), offline mode |
| 9 | Planned | Production hardening — rate limiting, abuse detection, observability |

---

## API Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| GET | `/auth/me` | Current user |

### Sessions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/sessions` | Create session |
| GET | `/sessions` | List sessions (paginated) |
| GET | `/sessions/:id` | Get session + messages |
| PATCH | `/sessions/:id` | Update title |
| DELETE | `/sessions/:id` | Delete session |

### WebSocket
```
ws://localhost:3001/ws?token=<jwt>&sessionId=<uuid>
```

---

## License

MIT

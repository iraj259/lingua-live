import { AIError } from "./errors.js";
import { logger } from "./logger.js";

const GROQ_API_KEY = process.env["GROQ_API_KEY"];
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export const MODELS = {
  MAIN: "llama-3.3-70b-versatile",
  FAST: "llama-3.1-8b-instant",
} as const;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ── The entire AI layer for Phase 1 ───────────────────────────────────────
// One function. No class. No abstraction. You have one call site.
// Extract to a class in Phase 4 when you have three call sites.
export async function generateResponse(
  messages: ChatMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const { model = MODELS.MAIN, temperature = 0.7, maxTokens = 600 } = options;

  const startTime = Date.now();

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "unknown");

    if (response.status === 429) {
      logger.warn("Groq rate limit hit");
      throw new AIError("Too many requests right now. Please wait a moment and try again.");
    }

    logger.error("Groq API error", { status: response.status, body: errorBody });
    throw new AIError();
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string | null } }>;
    usage: { total_tokens: number };
  };

  const content = data.choices[0]?.message.content;
  if (!content) throw new AIError("AI returned an empty response.");

  logger.debug("Groq response", {
    model,
    tokens: data.usage.total_tokens,
    durationMs: Date.now() - startTime,
  });

  return content;
}

// ── System prompt builder ──────────────────────────────────────────────────
// This is the "agent" for Phase 1. A well-crafted prompt function.
// In Phase 2 this moves into a ScenarioAgent class.
export function buildSystemPrompt(language: string, level: string): string {
  const lang = capitalize(language);

  const levelInstructions: Record<string, string> = {
    beginner: `
- Use very simple sentences (subject + verb + object)
- Limit to the 500 most common words
- Always translate any unfamiliar word in parentheses: "Quiero (I want)"
- Repeat key words in different ways to reinforce them
- Be extremely patient and encouraging`,
    intermediate: `
- Use natural sentence structures with moderate complexity
- Introduce common idioms and explain them briefly
- Mix tenses naturally (present, past, future)
- Correct mistakes gently by modeling the correct form inline`,
    advanced: `
- Speak at native speed and complexity
- Use idioms, regional expressions, and advanced grammar freely
- Correct only in the target language
- Engage with complex topics: culture, opinion, abstract ideas`,
  };

  return `You are a warm, patient, encouraging ${lang} language tutor.
Your student is practicing ${lang} at the ${level} level.

YOUR ROLE:
- Have natural conversations entirely in ${lang}
- Help the student practice real-world language use
- Correct grammar and vocabulary mistakes by modeling the correct form naturally
- Never say "that's wrong" — instead use the correct form in your response
- Only correct one or two things per message so you don't overwhelm them

LEVEL INSTRUCTIONS:
${levelInstructions[level] ?? ""}

STYLE:
- Be warm, human, and encouraging
- Respond as a character in a realistic scenario (café, market, hotel, etc.)
- Ask follow-up questions to keep the student talking
- Your goal is to build confidence, not to test them`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
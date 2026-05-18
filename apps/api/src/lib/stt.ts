/**
 * Speech to Text via Groq Whisper API.
 *
 * Takes base64 encoded audio from the browser,
 * sends it to Groq Whisper, returns the transcript string.
 *
 * Same API key as the LLM — no extra setup needed.
 */

import { logger } from "./logger.js";

const GROQ_API_KEY = process.env["GROQ_API_KEY"];

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  language: string
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
  }

  // Convert base64 to binary
  const binaryStr = atob(audioBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Build multipart form — Groq Whisper expects a file upload
  const blob = new Blob([bytes], { type: mimeType });
  const form = new FormData();

  // File extension must match the mime type
  const ext = mimeType.includes("webm") ? "webm" : "wav";
  form.append("file", blob, `audio.${ext}`);
  form.append("model", "whisper-large-v3");

  // Hint the language to improve accuracy
  // Groq Whisper uses ISO 639-1 codes: "es", "fr", "de" etc.
  const langCode = LANGUAGE_CODES[language] ?? "en";
  form.append("language", langCode);

  form.append("response_format", "json");

  const startTime = Date.now();

  const res = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        // Do NOT set Content-Type here — fetch sets it automatically
        // with the correct boundary for multipart/form-data
      },
      body: form,
    }
  );

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    logger.error("Whisper API error", { status: res.status, err });
    throw new Error(`Whisper error ${res.status}: ${err}`);
  }

  const data = await res.json() as { text: string };

  logger.debug("STT complete", {
    language,
    durationMs: Date.now() - startTime,
    transcript: data.text.slice(0, 50),
  });

  return data.text.trim();
}

// Groq Whisper language codes
const LANGUAGE_CODES: Record<string, string> = {
  spanish:    "es",
  french:     "fr",
  german:     "de",
  italian:    "it",
  japanese:   "ja",
  mandarin:   "zh",
  portuguese: "pt",
  arabic:     "ar",
};
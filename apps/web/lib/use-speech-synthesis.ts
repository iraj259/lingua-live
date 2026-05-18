"use client";

/**
 * useSpeechSynthesis
 *
 * Wraps the browser Web Speech API for text to speech.
 * Free, zero latency, works in all modern browsers.
 * Automatically selects the correct voice for the target language.
 *
 * Phase 3: Browser TTS — free, instant, good enough.
 * Phase 5+: Can swap to ElevenLabs for better voice quality.
 */

import { useState, useCallback, useRef } from "react";

// BCP 47 language tags for Web Speech API voice selection
const VOICE_LANG_MAP: Record<string, string> = {
  spanish:    "es-ES",
  french:     "fr-FR",
  german:     "de-DE",
  italian:    "it-IT",
  japanese:   "ja-JP",
  mandarin:   "zh-CN",
  portuguese: "pt-BR",
  arabic:     "ar-SA",
};

interface UseSpeechSynthesisReturn {
  isSpeaking: boolean;
  speak:      (text: string) => void;
  cancel:     () => void;
  isSupported: boolean;
}

export function useSpeechSynthesis(
  language: string
): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window;

  const speak = useCallback((text: string) => {
    if (!isSupported || !text.trim()) return;

    // Cancel any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Set language for voice selection
    utterance.lang  = VOICE_LANG_MAP[language] ?? "en-US";
    utterance.rate  = 0.9;   // slightly slower than default — easier to follow
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);

  }, [isSupported, language]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return { isSpeaking, speak, cancel, isSupported };
}
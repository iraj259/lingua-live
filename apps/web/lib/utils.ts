import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const LANGUAGE_CONFIG = {
  spanish:    { label: "Spanish",    flag: "🇪🇸", nativeName: "Español" },
  french:     { label: "French",     flag: "🇫🇷", nativeName: "Français" },
  german:     { label: "German",     flag: "🇩🇪", nativeName: "Deutsch" },
  italian:    { label: "Italian",    flag: "🇮🇹", nativeName: "Italiano" },
  japanese:   { label: "Japanese",   flag: "🇯🇵", nativeName: "日本語" },
  mandarin:   { label: "Mandarin",   flag: "🇨🇳", nativeName: "普通话" },
  portuguese: { label: "Portuguese", flag: "🇧🇷", nativeName: "Português" },
  arabic:     { label: "Arabic",     flag: "🇸🇦", nativeName: "العربية" },
} as const;

export const LEVEL_CONFIG = {
  beginner:     { label: "Beginner",     description: "Simple sentences, common vocabulary", color: "text-emerald-700 bg-emerald-50" },
  intermediate: { label: "Intermediate", description: "Natural grammar, some idioms",        color: "text-blue-700 bg-blue-50" },
  advanced:     { label: "Advanced",     description: "Fluent, idiomatic, native speed",     color: "text-purple-700 bg-purple-50" },
} as const;

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

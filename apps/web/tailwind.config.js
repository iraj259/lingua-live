/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sora)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      colors: {
        ink:          "#0A0F1C",
        paper:        "#F5F3EE",
        cream:        "#EDE9E0",
        accent:       "#1A56DB",
        "accent-soft":"#EFF3FF",
        muted:        "#6B7280",
        border:       "#E4E0D8",
        success:      "#059669",
        warning:      "#D97706",
        danger:       "#DC2626",
      },
    },
  },
  plugins: [],
};
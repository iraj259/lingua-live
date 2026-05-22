/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["var(--font-sora)", "system-ui", "sans-serif"],
        mono:    ["var(--font-jetbrains)", "monospace"],
        display: ["var(--font-unbounded)", "system-ui", "sans-serif"],
      },
      colors: {
        // Dark cosmic palette
        ink:          "#ede4ff",
        "ink-dim":    "#b5a8d4",
        "ink-mute":   "#6e6585",
        paper:        "#050208",
        bg1:          "#0c0420",
        bg2:          "#1a0a3a",
        accent:       "#a855f7",
        "accent-soft":"rgba(168,85,247,0.12)",
        violet:       "#7c3aed",
        "violet-2":   "#a855f7",
        magenta:      "#d946ef",
        pink:         "#f472b6",
        border:       "rgba(255,255,255,0.18)",
        muted:        "#b5a8d4",
        success:      "#34d399",
        warning:      "#fbbf24",
        danger:       "#f87171",
        cream:        "rgba(255,255,255,0.06)",
      },
    },
  },
  plugins: [],
};

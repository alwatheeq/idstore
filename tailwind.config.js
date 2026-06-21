/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#fafaf7",
        "paper-2": "#f1f1ea",
        surface: "#ffffff",
        ink: "#15171c",
        "ink-2": "#3a3d44",
        muted: "#6b6f76",
        line: "rgba(21,23,28,0.10)",
        "line-strong": "rgba(21,23,28,0.18)",
        volt: "#aee82b",
        "volt-deep": "#6c9a00",
        "volt-soft": "rgba(174,232,43,0.18)",
        ok: "#1f9d55",
        "ok-soft": "rgba(31,157,85,0.12)",
        warn: "#b7791f",
        "warn-soft": "rgba(183,121,31,0.14)",
        danger: "#c7341f",
        "danger-soft": "rgba(199,52,31,0.10)",
        info: "#4b5563",
        "info-soft": "rgba(75,85,99,0.10)",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
        arabic: ['"IBM Plex Sans Arabic"', '"IBM Plex Sans"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(21,23,28,0.04), 0 2px 8px rgba(21,23,28,0.05)",
        "card-lg": "0 12px 32px -8px rgba(21,23,28,0.18)",
        volt: "0 0 0 3px rgba(174,232,43,0.35)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      letterSpacing: {
        micro: "0.14em",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "charge-in": {
          "0%": { width: "0%" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "charge-in": "charge-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

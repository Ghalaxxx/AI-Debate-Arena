import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        arena: {
          black: "#0A0A0F",
          panel: "#12131B",
          panelSoft: "#181923",
          line: "#292B38",
          text: "#F4F2EC",
          muted: "#A8ABB8",
          purple: "#7F77DD",
          coral: "#D85A30",
          teal: "#5DCAA5",
          amber: "#EF9F27",
          red: "#E24B4A"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(127, 119, 221, 0.18), 0 20px 60px rgba(0, 0, 0, 0.35)"
      },
      keyframes: {
        tagline: {
          "0%, 100%": { opacity: "0.62", transform: "translateY(0)" },
          "50%": { opacity: "1", transform: "translateY(-2px)" }
        },
        pulseBorder: {
          "0%, 100%": { borderColor: "rgba(127, 119, 221, 0.35)" },
          "50%": { borderColor: "rgba(93, 202, 165, 0.85)" }
        },
        scoreIn: {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        }
      },
      animation: {
        tagline: "tagline 3.4s ease-in-out infinite",
        pulseBorder: "pulseBorder 1.4s ease-in-out infinite",
        scoreIn: "scoreIn 220ms ease-out both"
      }
    }
  },
  plugins: []
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f1418",
        foreground: "#dee3e9",
        surface: {
          lowest: "#0a0f13",
          dim: "#0f1418",
          DEFAULT: "#13181d",
          low: "#171c20",
          card: "#1b2024",
          high: "#252b2f",
          highest: "#30353a",
          bright: "#353a3e",
        },
        border: {
          subtle: "#232a30",
          DEFAULT: "#2d363e",
          focus: "#465563",
        },
        brand: {
          cyan: "#38bdf8",
          blue: "#60a5fa",
          emerald: "#34d399",
          amber: "#fbbf24",
          red: "#f87171",
          purple: "#c084fc",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(0, 0, 0, 0.5)",
        card: "0 2px 12px -1px rgba(0, 0, 0, 0.4)",
        glowCyan: "0 0 20px -4px rgba(56, 189, 248, 0.35)",
        glowRed: "0 0 20px -4px rgba(248, 113, 113, 0.35)",
        glowAmber: "0 0 20px -4px rgba(251, 191, 36, 0.35)",
        glowEmerald: "0 0 20px -4px rgba(52, 211, 153, 0.35)",
      },
    },
  },
  plugins: [],
};
export default config;

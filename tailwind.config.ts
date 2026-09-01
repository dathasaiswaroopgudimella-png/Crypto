import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        cyber: {
          dark: "#05070D",
          panel: "#0B101E",
          card: "#10182C",
          border: "#1E2C4A",
          cyan: "#00F0FF",
          blue: "#3B82F6",
          red: "#FF3366",
          amber: "#F59E0B",
          emerald: "#10B981",
          purple: "#8B5CF6",
          gold: "#FCD34D",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      boxShadow: {
        neon: "0 0 20px -5px rgba(0, 240, 255, 0.3)",
        danger: "0 0 20px -5px rgba(255, 51, 102, 0.4)",
        success: "0 0 20px -5px rgba(16, 185, 129, 0.4)",
        gold: "0 0 20px -5px rgba(252, 211, 77, 0.4)",
      },
    },
  },
  plugins: [],
};
export default config;

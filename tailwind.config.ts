import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "ai-blue": "#2D6FE8",
        "blue-light": "#4B8EFF",
        "velocity-red": "#FF4D1C",
        "deep-black": "#0A0A0B",
        surface: "#111116",
        navy: "#0D1428",
        "off-white": "#F4F6FA",
        slate: "#6B82A8",
        border: "#1E1E28",
      },
      fontFamily: {
        grotesk: ["var(--font-space-grotesk)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
      borderRadius: {
        card: "12px",
        "card-lg": "14px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4)",
        glow: "0 0 20px rgba(45,111,232,0.15)",
      },
    },
  },
  plugins: [],
};
export default config;

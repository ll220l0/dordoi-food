import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
        "3xl": "24px"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        card: "0 1px 3px rgba(0,0,0,0.06), 0 6px 16px rgba(0,0,0,0.04)",
        elevated: "0 8px 32px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.04)",
        glow: "0 8px 24px -8px rgba(249,115,22,0.4)"
      }
    }
  },
  plugins: []
} satisfies Config;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0a0e1a",
          800: "#0f1524",
          700: "#161d31",
          600: "#1e2740",
        },
        risk: {
          low: "#22c55e",
          medium: "#eab308",
          high: "#f97316",
          severe: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(239,68,68,0.5)" },
          "70%": { boxShadow: "0 0 0 12px rgba(239,68,68,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(239,68,68,0)" },
        },
      },
      animation: {
        pulseRing: "pulseRing 2s infinite",
      },
    },
  },
  plugins: [],
};

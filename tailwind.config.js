import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        recording: {
          DEFAULT: "hsl(var(--recording))",
          foreground: "hsl(var(--recording-foreground))",
        },
        processing: {
          DEFAULT: "hsl(var(--processing))",
          foreground: "hsl(var(--processing-foreground))",
        },
        "ai-badge": {
          DEFAULT: "hsl(var(--ai-badge))",
          foreground: "hsl(var(--ai-badge-foreground))",
        },
        "border-glass": "rgba(255, 255, 255, 0.08)",
        obsidian: {
          950: "#09090b",
          900: "#121215",
          850: "#18181b",
          800: "#27272a",
        },
      },
      borderRadius: {
        xl: "var(--radius-xl, 12px)",
        lg: "var(--radius, 8px)",
        md: "calc(var(--radius, 8px) - 2px)",
        sm: "calc(var(--radius, 8px) - 4px)",
        full: "9999px",
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Segoe UI Variable Text", "Segoe UI", "sans-serif"],
        mono: ["'JetBrains Mono'", "Cascadia Code", "Consolas", "monospace"],
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: "#09090b",
          900: "#121215",
          850: "#18181b",
          800: "#27272a",
        }
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Segoe UI Variable Text", "Segoe UI", "sans-serif"],
        mono: ["'JetBrains Mono'", "Cascadia Code", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
}

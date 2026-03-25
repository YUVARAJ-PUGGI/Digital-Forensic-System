/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#060b14',
          800: '#0f172a',
          700: '#1e293b',
          600: '#334155',
        },
        neon: {
          blue: '#0ea5e9',
          purple: '#22c55e',
          cyan: '#14b8a6',
        }
      }
    },
  },
  plugins: [],
}

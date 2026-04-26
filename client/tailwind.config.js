/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fintech: {
          dark: '#0f172a',    // slate-900
          darker: '#020617',  // slate-950
          card: '#1e293b',    // slate-800
          primary: '#10b981', // emerald-500
          secondary: '#3b82f6', // blue-500
          accent: '#8b5cf6',  // violet-500
          text: '#f8fafc',    // slate-50
          muted: '#94a3b8',   // slate-400
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

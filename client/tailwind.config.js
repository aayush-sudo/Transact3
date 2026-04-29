/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        velto: {
          lime:       '#C6FF00', // signature lime-green
          'lime-dark':'#AEEA00', // slightly deeper lime for hover
          forest:     '#1A3A1A', // deep forest green (dark backgrounds)
          'forest-mid':'#2D5A2D', // medium forest green (cards on dark)
          'forest-light':'#3D7A3D', // lighter forest green (borders, accents)
          offwhite:   '#F0F0EC', // page background
          surface:    '#E8E8E4', // card backgrounds on light pages
          'surface-dark':'#DEDED8', // deeper surface
          ink:        '#111111', // primary text
          muted:      '#555555', // secondary text
          faint:      '#888888', // placeholder text
        },
        // Keep "fintech-*" aliases pointing to new Velto values so
        // existing className references continue to work
        fintech: {
          dark:    '#2D5A2D',
          darker:  '#1A3A1A',
          card:    '#2D5A2D',
          primary: '#C6FF00',
          secondary:'#AEEA00',
          accent:  '#C6FF00',
          text:    '#F0F0EC',
          muted:   '#AEEA00',
        }
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

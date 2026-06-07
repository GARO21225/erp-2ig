/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        '2ig': { blue: '#1a3f6f', orange: '#E87722', gold: '#F5A623' },
        yakro: { DEFAULT: '#8B1A1A', light: '#FDF2F2' },
        toptelsig: { DEFAULT: '#1a3f6f', light: '#EEF3FB' },
        liya: { DEFAULT: '#E85D04', light: '#FFF0EB' },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

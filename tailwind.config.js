/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        marvil: {
          orange: '#FF6600',
          orangeLight: '#FF7F24',
          orangeDark: '#CC5200',
          black: '#000000',
          dark: '#0D0D0D',
          card: '#1A1A1A',
          border: '#2D2D2D'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 15px rgba(255, 102, 0, 0.3)',
        'glow-strong': '0 0 25px rgba(255, 102, 0, 0.6)',
      }
    },
  },
  plugins: [],
}
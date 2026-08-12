/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        asteryon: {
          950: '#081527',
          900: '#0B1D33',
          700: '#123A63',
          600: '#0B5D3B',
          400: '#E5B93D'
        }
      }
    }
  },
  plugins: []
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f1f8f2',
          100: '#dcefe1',
          200: '#b9d8c1',
          300: '#8fbea0',
          400: '#5ea074',
          500: '#3f8858',
          600: '#2f7d4a',
          700: '#25633b',
          800: '#1f4f31',
          900: '#183f28',
        }
      }
    },
  },
  plugins: [],
}

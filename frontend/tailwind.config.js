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
          50: '#f7fdf7',
          100: '#edfbee',
          200: '#dff7e1',
          300: '#c8f2cc',
          400: '#abf7b1',
          500: '#5ced73',
          600: '#39e75f',
          700: '#1fd655',
          800: '#00c04b',
          900: '#00963d',
        }
      }
    },
  },
  plugins: [],
}

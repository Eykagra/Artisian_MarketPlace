/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        artisan: {
          cream: '#faf8f5',
          stone: '#78716c',
          bark: '#1c1917',
          terracotta: '#c2410c',
          sage: '#4d7c0f',
        },
      },
    },
  },
  plugins: [],
}

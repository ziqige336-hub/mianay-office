/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'neutral-750': '#29292e',
        'neutral-850': '#1a1a1d',
      },
    },
  },
  plugins: [],
};

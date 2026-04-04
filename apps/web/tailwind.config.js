/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:     ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        headline: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'sans-serif'],
        body:     ['"Plus Jakarta Sans"', 'ui-sans-serif', 'sans-serif'],
        label:    ['"Plus Jakarta Sans"', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        terracotta: '#cb997e',
        coral:      '#ffb4a2',
        olive:      '#a5a58d',
        gold:       '#d4a373',
        beige:      '#f5ebe0',
      },
    },
  },
  plugins: [],
};

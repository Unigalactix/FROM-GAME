/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'monospace'],
        type: ['"Special Elite"', 'serif'],
      },
      colors: {
        amber: { rust: '#b06a2c' },
        blood: '#7e1414',
      },
    },
  },
  plugins: [],
};

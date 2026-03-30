const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src/**/*.{js,jsx}'),
  ],
  theme: {
    extend: {
      colors: {
        atlas: {
          night: '#0b0b0b',
          ink: '#f5f7fa',
          slate: '#a1a1aa',
          mist: '#121316',
          paper: '#0f1012',
          panel: '#17181c',
          line: '#2a2c31',
          accent: '#3b82f6',
          accentSoft: '#172554',
          success: '#22c55e',
          successSoft: '#052e16',
          skipped: '#3f3f46',
          danger: '#ef4444',
        },
      },
      boxShadow: {
        panel: '0 16px 48px rgba(0, 0, 0, 0.28)',
      },
      fontFamily: {
        display: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        body: ['"Segoe UI"', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

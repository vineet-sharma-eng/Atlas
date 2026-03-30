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
          night: '#101826',
          ink: '#182235',
          slate: '#5f6c85',
          mist: '#eef2f7',
          paper: '#f4f0e8',
          panel: '#fcfaf6',
          line: '#d8d2c7',
          accent: '#c56a1a',
          accentSoft: '#f4dfcb',
          success: '#166534',
        },
      },
      boxShadow: {
        panel: '0 24px 60px rgba(16, 24, 38, 0.08)',
      },
      fontFamily: {
        display: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        body: ['"Segoe UI"', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

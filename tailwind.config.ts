import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace']
      },
      colors: {
        ink: {
          50: '#f7f7f6',
          100: '#e8e8e6',
          200: '#cfcfcb',
          300: '#a8a8a2',
          400: '#7a7a73',
          500: '#54544d',
          600: '#3b3b35',
          700: '#2a2a25',
          800: '#1a1a17',
          900: '#0f0f0d'
        },
        accent: {
          DEFAULT: '#c64a1f',
          50: '#fdf2ed',
          100: '#fbe1d3',
          500: '#c64a1f',
          600: '#a73d18'
        }
      }
    }
  },
  plugins: []
};

export default config;

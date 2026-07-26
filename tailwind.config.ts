import type { Config } from 'tailwindcss';

const config: Config = {
  // lib/ is scanned too — the shared prose classes (PROSE_CLASS,
  // EDITORIAL_PROSE_CLASS) live in lib/markdown.ts, and their arbitrary
  // variants are only generated if Tailwind sees that file.
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Editorial display serif — system serifs only, no web-font fetches.
        display: ['Iowan Old Style', 'Palatino', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace']
      },
      colors: {
        // Warm off-white canvas — Rho-adjacent: paper, not screen.
        cream: {
          DEFAULT: '#f6f2ea',
          50: '#fbf9f4',
          100: '#f6f2ea',
          200: '#ede6d8'
        },
        ink: {
          50: '#f7f5f0',
          100: '#e8e5db',
          200: '#cfccc0',
          300: '#a8a59a',
          400: '#7a7770',
          500: '#54524c',
          600: '#3b3a34',
          700: '#2a2924',
          800: '#1a1a16',
          900: '#0f0f0c'
        },
        accent: {
          DEFAULT: '#c64a1f',
          50: '#fdf2ed',
          100: '#fbe1d3',
          500: '#c64a1f',
          600: '#a73d18'
        }
      },
      letterSpacing: {
        eyebrow: '0.14em'
      }
    }
  },
  plugins: []
};

export default config;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#080b10',
          900: '#0b0f14',
          800: '#111820',
          700: '#16202b',
          600: '#1d2a38',
          500: '#273748',
        },
        line: '#223040',
        fg: '#d6dde6',
        muted: '#8593a3',
        faint: '#5d6b7b',
        accent: { DEFAULT: '#4aa3df', strong: '#2f86c4', soft: '#12384f' },
        crit: '#e5484d',
        high: '#f0883e',
        med: '#d6b13a',
        low: '#5aa88a',
        ok: '#3fb68b',
        warn: '#e0a93a',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        DEFAULT: '4px',
      },
    },
  },
  plugins: [],
};

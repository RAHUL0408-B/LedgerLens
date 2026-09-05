/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // LedgerLens design tokens — professional finance palette
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8f9fa',
          subtle: '#f1f3f5',
          border: '#e9ecef',
        },
        ink: {
          DEFAULT: '#0f1117',
          secondary: '#495057',
          tertiary: '#868e96',
          disabled: '#adb5bd',
        },
        brand: {
          DEFAULT: '#0052cc',
          hover: '#0043a8',
          light: '#e6f0ff',
        },
        status: {
          matched: '#2b8a3e',
          'matched-bg': '#ebfbee',
          exception: '#e67700',
          'exception-bg': '#fff3bf',
          review: '#1971c2',
          'review-bg': '#e7f5ff',
          unresolved: '#c92a2a',
          'unresolved-bg': '#fff5f5',
          critical: '#862e9c',
          'critical-bg': '#f8f0fc',
        },
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
};

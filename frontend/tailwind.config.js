/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--bg)',
          card: 'var(--bg2)',
          elevated: 'var(--bg3)',
          border: 'var(--bg4)',
        },
        content: {
          DEFAULT: 'var(--text)',
          secondary: 'var(--text2)',
          tertiary: 'var(--text3)',
          muted: 'var(--text4)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          text: 'var(--brand-text)',
          bg: 'var(--brand-bg)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          green: 'var(--green)',
          red: 'var(--red)',
          blue: 'var(--blue)',
          amber: 'var(--amber)',
          purple: 'var(--purple)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', '"SF Pro Text"', '"SF Pro Display"', '"Inter"', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"SF Mono"', '"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        '2xs': ['12px', '16px'],
        xs: ['13px', '18px'],
        sm: ['14px', '20px'],
        base: ['15px', '22px'],
        lg: ['17px', '24px'],
        xl: ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['32px', '36px'],
        '4xl': ['48px', '1'],
        '5xl': ['56px', '1'],
      },
      borderRadius: {
        DEFAULT: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '24px',
      },
      spacing: {
        4.5: '18px',
        13: '52px',
        18: '72px',
      },
      keyframes: {
        shimmer: { '0%,100%': { opacity: '0.3' }, '50%': { opacity: '0.6' } },
        pulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
        fadeIn: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { '0%': { opacity: '0', transform: 'translateX(-8px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        logoDot: { '0%,100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0.5)' }, '70%': { boxShadow: '0 0 0 8px transparent' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        pulse: 'pulse 1.5s ease-in-out infinite',
        fadeIn: 'fadeIn 0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
        slideIn: 'slideIn 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
        logoDot: 'logoDot 2s infinite',
        scaleIn: 'scaleIn 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
      },
    },
  },
  plugins: [],
};

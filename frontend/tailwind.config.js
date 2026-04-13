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
        sans: ['"SF Pro Text"', '"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs: ['11px', '16px'],
        sm: ['12px', '16px'],
        base: ['13px', '18px'],
        lg: ['15px', '20px'],
        xl: ['18px', '24px'],
        '2xl': ['22px', '28px'],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
      },
      spacing: {
        4.5: '18px',
        13: '52px',
      },
      keyframes: {
        shimmer: {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '0.5' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        logoDot: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(63,185,80,0.4)' },
          '70%': { boxShadow: '0 0 0 6px transparent' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        pulse: 'pulse 1.5s infinite',
        fadeIn: 'fadeIn 0.2s ease-out',
        slideIn: 'slideIn 0.2s ease-out',
        logoDot: 'logoDot 2s infinite',
      },
    },
  },
  plugins: [],
};

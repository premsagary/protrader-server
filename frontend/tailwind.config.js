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
        sans: ['-apple-system', '"SF Pro Text"', '"SF Pro Display"', '"Inter"', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', '"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', '14px'],
        xs: ['12px', '16px'],
        sm: ['13px', '18px'],
        base: ['14px', '20px'],
        lg: ['16px', '22px'],
        xl: ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['30px', '36px'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      spacing: {
        4.5: '18px',
        13: '52px',
        18: '72px',
      },
      keyframes: {
        shimmer: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        logoDot: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(52,199,89,0.4)' },
          '70%': { boxShadow: '0 0 0 6px transparent' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        pulse: 'pulse 1.5s ease-in-out infinite',
        fadeIn: 'fadeIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        slideIn: 'slideIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        logoDot: 'logoDot 2s infinite',
        scaleIn: 'scaleIn 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
    },
  },
  plugins: [],
};

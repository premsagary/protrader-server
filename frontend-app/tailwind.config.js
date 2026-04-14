/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#6366F1', hover: '#4F46E5', text: '#A5B4FC' },
      },
      fontFamily: {
        sans: ['-apple-system', '"SF Pro Display"', '"SF Pro Text"', 'Inter', 'BlinkMacSystemFont', 'sans-serif'],
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
      },
    },
  },
  plugins: [],
};

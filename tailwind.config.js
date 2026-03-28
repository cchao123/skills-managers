/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/index.html",
    "./app/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 保持原有的 Claude Code 风格配色
        gray: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        // Dark theme 配色 - 优化文字对比度
        dark: {
          bg: '#0a0a0a',
          'bg-secondary': '#141414',
          'bg-tertiary': '#1c1c1c',
          'bg-card': '#171717',
          border: '#2a2a2a',
          text: '#f5f5f5',
          'text-secondary': '#c5c5c5',
          'text-tertiary': '#9a9a9a',
          hover: '#222222',
          active: '#2a2a2a',
        },
        // Toast semantic colors
        info: '#007AFF',
        success: '#34C759',
        warning: '#FF9500',
        error: '#FF4D4D',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

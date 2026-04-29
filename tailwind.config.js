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
        // Dark theme 配色 - 与浅色模式的"明暗层级"对齐：
        //   浅色 sidebar(#edeeef) → main(#f8f9fa) → card(#ffffff)
        //   深色 sidebar(bg)      → main(bg-secondary) → card(bg-card)
        // 让相邻层级的差距均匀（约 10 个单位），避免"卡片几乎贴在主区上"。
        dark: {
          bg: '#0a0a0a',           // 侧边栏 / 最暗的次要面板
          'bg-secondary': '#141414', // 主内容区背景
          'bg-card': '#1f1f1f',    // 卡片（浮起在主区之上）
          'bg-tertiary': '#262626',  // hover / 更亮一档的内嵌面板
          border: '#2a2a2a',
          text: '#f5f5f5',
          'text-secondary': '#c5c5c5',
          'text-tertiary': '#9a9a9a',
          hover: '#2a2a2a',
          active: '#333333',
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

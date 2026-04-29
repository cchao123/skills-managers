import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import Icons from 'unplugin-icons/vite';
import path from 'path';
import { readFileSync } from 'fs';

/**
 * Web Preview 构建配置。
 *
 * 目标：把现有 Tauri React 应用原封不动地跑在浏览器里，供官网 iframe 预览使用。
 *
 * 实现手段：通过 resolve.alias 在构建期把所有 `@tauri-apps/*` 包替换成
 * 同构 mock 实现，这样 `api/tauri.ts` 等业务代码完全无需感知预览模式。
 *
 * 产物输出到 `docs/preview/`，随 `docs/` 目录一起由 GitHub Pages 发布。
 */
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, './package.json'), 'utf-8')
) as { version: string };

export default defineConfig({
  // 部署路径：GitHub Pages 会把仓库挂在 /<repo>/preview/ 下
  // 本地 `npm run preview:dev` 时用相对路径，构建时再切到仓库路径
  base: './',

  plugins: [
    react(),
    Icons({
      compiler: 'jsx',
      jsx: 'react',
      autoInstall: false,
    }),
  ],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './app/src') },
      // 关键：把 Tauri SDK 的真实模块路径重定向到 preview 目录下的 mock
      {
        find: /^@tauri-apps\/api\/core$/,
        replacement: path.resolve(__dirname, './app/src/preview/mocks/tauri-core.ts'),
      },
      {
        find: /^@tauri-apps\/api\/webview$/,
        replacement: path.resolve(__dirname, './app/src/preview/mocks/tauri-webview.ts'),
      },
      {
        find: /^@tauri-apps\/plugin-shell$/,
        replacement: path.resolve(__dirname, './app/src/preview/mocks/tauri-shell.ts'),
      },
    ],
  },

  publicDir: 'app/public',

  build: {
    outDir: path.resolve(__dirname, './docs/preview'),
    emptyOutDir: true,
    // Preview 是次级资源，不需要 source map 占空间
    sourcemap: false,
    rollupOptions: {
      // 显式指定 preview.html 为入口（否则 Vite 会去找根目录的 index.html）
      input: path.resolve(__dirname, './preview.html'),
    },
  },

  server: {
    port: 5174,
    open: '/preview.html',
  },
});

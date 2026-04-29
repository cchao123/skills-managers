import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { codeInspectorPlugin } from 'code-inspector-plugin';
import Icons from 'unplugin-icons/vite';
import path from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "./package.json"), "utf-8")
) as { version: string };

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    codeInspectorPlugin({
      bundler: 'vite',
    }),
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
    alias: {
      "@": path.resolve(__dirname, "./app/src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  // 4. specify public directory location
  publicDir: 'app/public',
}));

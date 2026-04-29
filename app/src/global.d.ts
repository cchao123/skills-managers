/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/react" />

declare const __APP_VERSION__: string;

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}

interface Window {
  __TAURI__?: {
    core?: {
      invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  };
}

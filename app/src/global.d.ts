declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}

declare module '/octopus-logo.png' {
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

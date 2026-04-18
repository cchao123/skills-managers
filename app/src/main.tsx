import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './assets/styles/index.css';
import './i18n/config';
import { isTauri } from '@/lib/tauri-env';
import { initTelemetry } from '@/lib/telemetry';

if (import.meta.env.DEV) {
  console.log('Main.tsx loaded');
  console.log('Tauri API available:', isTauri());
}

initTelemetry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

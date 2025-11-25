import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Polyfill for Vercel/Vite environment
// This ensures process.env.API_KEY is available to the Google GenAI SDK
if (typeof window !== 'undefined') {
  if (!(window as any).process) {
    (window as any).process = { env: {} };
  }
  
  // Map the VITE_ prefixed variable (exposed by Vercel/Vite) to the standard process.env key
  // @ts-ignore
  if (import.meta.env && import.meta.env.VITE_API_KEY) {
    // @ts-ignore
    (window as any).process.env.API_KEY = import.meta.env.VITE_API_KEY;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
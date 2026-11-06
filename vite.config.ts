import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import hosting from './vercel.json';
const headers = Object.fromEntries(hosting.headers[0].headers.map(({key,value})=>[key,value]));
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 900 },
  preview: { headers },
  server: { headers: { ...headers, 'Content-Security-Policy': headers['Content-Security-Policy'].replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:* ws://localhost:*") } },
});

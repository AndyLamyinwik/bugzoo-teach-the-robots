import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolveBasePath } from './src/deployment/basePath.ts';

export default defineConfig({
  base: resolveBasePath(process.env.BUGZOO_BASE_PATH),
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
});

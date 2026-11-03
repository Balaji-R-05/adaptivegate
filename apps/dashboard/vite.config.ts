import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Read the monorepo-root .env instead of expecting a copy in this app.
  envDir: '../../',
  server: {
    port: 5173,
  },
});

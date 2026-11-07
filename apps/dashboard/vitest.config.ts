import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Separate from the root vitest.config.ts, which explicitly excludes this
// app (component tests need a DOM environment; everything else in the
// monorepo is plain Node). Run with `pnpm --filter @adaptivegate/dashboard
// test`.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
  },
});

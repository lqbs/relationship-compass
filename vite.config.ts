import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const apiPort = process.env.RC_PORT ?? '4780';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${apiPort}`,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

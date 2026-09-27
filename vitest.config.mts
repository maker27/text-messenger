import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    env: {
      GREEN_API_MOCK_URL: 'http://127.0.0.1:3100',
      LOG_LEVEL: 'silent',
      SESSION_SECRET: 'test-session-secret-with-32-characters',
    },
    environment: 'node',
    include: ['src/**/*.test.ts', 'mock/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});

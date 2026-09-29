import { defineConfig, devices } from '@playwright/test';

const APP_PORT = 3200;
const REAL_APP_PORT = 3201;
const MOCK_PORT = 3100;
const BASE_URL = `http://localhost:${String(APP_PORT)}/text-messenger/`;
const REAL_BASE_URL = `http://localhost:${String(REAL_APP_PORT)}/text-messenger/`;
const TEST_SESSION_SECRET = 'e2e-test-session-secret-with-32-plus-characters';
const REAL_PROJECT_TAG_PATTERN = /@real/;
const EXTERNAL_BASE_URL = process.env.E2E_BASE_URL;

const mockProject = {
  name: 'chromium',
  grepInvert: REAL_PROJECT_TAG_PATTERN,
  use: { ...devices['Desktop Chrome'] },
};

const realProject = {
  name: 'chromium-real',
  grep: REAL_PROJECT_TAG_PATTERN,
  use: { ...devices['Desktop Chrome'], baseURL: REAL_BASE_URL },
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: EXTERNAL_BASE_URL ?? BASE_URL,
    trace: 'on-first-retry',
  },
  projects: EXTERNAL_BASE_URL ? [mockProject] : [mockProject, realProject],
  webServer: EXTERNAL_BASE_URL
    ? undefined
    : [
        {
          command: 'node mock/server.ts',
          port: MOCK_PORT,
          env: { PORT: String(MOCK_PORT) },
          reuseExistingServer: !process.env.CI,
        },
        {
          command: 'node .next/standalone/server.js',
          url: `http://localhost:${String(APP_PORT)}/text-messenger/api/health`,
          env: {
            GREEN_API_MOCK_URL: `http://127.0.0.1:${String(MOCK_PORT)}`,
            PORT: String(APP_PORT),
            REAL_MODE_ENABLED: 'false',
            SESSION_SECRET: TEST_SESSION_SECRET,
          },
          reuseExistingServer: !process.env.CI,
        },
        {
          command: 'node .next/standalone/server.js',
          url: `http://localhost:${String(REAL_APP_PORT)}/text-messenger/api/health`,
          env: {
            GREEN_API_MOCK_URL: `http://127.0.0.1:${String(MOCK_PORT)}`,
            PORT: String(REAL_APP_PORT),
            REAL_MODE_ENABLED: 'true',
            SESSION_SECRET: TEST_SESSION_SECRET,
          },
          reuseExistingServer: !process.env.CI,
        },
      ],
});

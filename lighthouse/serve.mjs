import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const APP_HOST = '127.0.0.1';
const APP_PORT = 3200;
const MOCK_PORT = 3100;
const MOCK_READY_PATTERN = /listening/;
const SESSION_SECRET_BYTES = 32;
const FAILURE_EXIT_CODE = 1;

const mock = spawn('node', ['mock/server.ts'], {
  env: { ...process.env, PORT: String(MOCK_PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
let app = null;
let isStopping = false;

function startApp() {
  return spawn('node', ['.next/standalone/server.js'], {
    env: {
      ...process.env,
      GREEN_API_MOCK_URL: `http://127.0.0.1:${String(MOCK_PORT)}`,
      HOSTNAME: APP_HOST,
      PORT: String(APP_PORT),
      REAL_MODE_ENABLED: 'false',
      SESSION_SECRET: randomBytes(SESSION_SECRET_BYTES).toString('base64'),
    },
    stdio: 'inherit',
  });
}

function stopServers() {
  isStopping = true;
  mock.kill();
  app?.kill();
}

function handleServerExit(code) {
  if (!isStopping) {
    process.exitCode = code || FAILURE_EXIT_CODE;
    stopServers();
  }
}

mock.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);

  if (app === null && MOCK_READY_PATTERN.test(String(chunk))) {
    app = startApp();
    app.on('exit', handleServerExit);
  }
});
mock.on('exit', handleServerExit);
process.on('SIGINT', stopServers);
process.on('SIGTERM', stopServers);

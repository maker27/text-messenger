import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const MOCK_SERVER_PATH = fileURLToPath(new URL('../../../mock/server.ts', import.meta.url));
const MOCK_ENV = { PORT: '0', REPLY_DELAY_MS: '50', STATUS_DELAY_MS: '10' };
const LISTENING_PATTERN = /listening on (http:\/\/\S+)/;

async function readOrigin(stdout: Readable) {
  const lines = createInterface({ input: stdout });
  for await (const line of lines) {
    const origin = LISTENING_PATTERN.exec(line)?.[1];
    if (origin !== undefined) {
      lines.close();
      return origin;
    }
  }
  throw new Error('Mock server exited before listening');
}

export async function startMockProcess() {
  const mock = spawn(process.execPath, [MOCK_SERVER_PATH], {
    env: { ...process.env, ...MOCK_ENV },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const mockExit = once(mock, 'exit');
  const origin = await readOrigin(mock.stdout);

  return {
    origin,
    stop: async () => {
      mock.kill();
      await mockExit;
    },
  };
}

import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

const SCRIPT_PATH = path.resolve(import.meta.dirname, 'deploy.sh');
const NEW_SHA = 'new-sha';
const OLD_SHA = 'old-sha';
const BASE_PATH = '/text-messenger';
const HEALTH_URL = 'http://127.0.0.1:3999/text-messenger/api/health';
const TEST_TIMEOUT_MS = 10_000;

const DOCKER_STUB = `#!/usr/bin/env bash
echo "IMAGE_TAG=$IMAGE_TAG $*" >> calls.log
if [[ "$IMAGE_TAG" == "$UNAVAILABLE_TAG" ]]; then
  exit 1
fi
echo "$IMAGE_TAG" > running-tag
`;

const CURL_STUB = `#!/usr/bin/env bash
echo "$*" >> curl.log
[[ "$(cat running-tag)" == "$HEALTHY_TAG" ]] || exit 7
`;

let workDir: string;

async function writeStub(name: string, content: string) {
  const stubPath = path.join(workDir, 'bin', name);
  await writeFile(stubPath, content);
  await chmod(stubPath, 0o755);
}

function runDeploy(args: string[], healthyTag: string, unavailableTag = '') {
  return spawnSync('bash', [SCRIPT_PATH, ...args], {
    cwd: workDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      HEALTH_TIMEOUT_SECONDS: '2',
      HEALTHY_TAG: healthyTag,
      PATH: `${path.join(workDir, 'bin')}:${process.env.PATH ?? ''}`,
      UNAVAILABLE_TAG: unavailableTag,
    },
  });
}

function readWorkFile(name: string) {
  return readFile(path.join(workDir, name), 'utf8');
}

async function readDockerCalls() {
  return (await readWorkFile('calls.log')).trim().split('\n');
}

beforeEach(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), 'deploy-'));
  await mkdir(path.join(workDir, 'bin'));
  await writeFile(path.join(workDir, '.env'), 'SESSION_SECRET=secret\nAPP_PORT=3999\n');
  await writeStub('docker', DOCKER_STUB);
  await writeStub('curl', CURL_STUB);
});

afterEach(async () => {
  await rm(workDir, { force: true, recursive: true });
});

test('deploys a healthy image and records its sha', async () => {
  const result = runDeploy([NEW_SHA, BASE_PATH], NEW_SHA);

  expect(result.status).toBe(0);
  expect(await readWorkFile('.deployed-sha')).toBe(`${NEW_SHA}\n`);
  expect(await readDockerCalls()).toEqual([
    `IMAGE_TAG=${NEW_SHA} compose up -d --pull missing --no-build --remove-orphans`,
  ]);
});

test(
  'rolls back to the previous sha when the new image stays unhealthy',
  async () => {
    await writeFile(path.join(workDir, '.deployed-sha'), `${OLD_SHA}\n`);

    const result = runDeploy([NEW_SHA, BASE_PATH], OLD_SHA);

    expect(result.status).toBe(1);
    expect((await readDockerCalls()).at(-1)).toBe(
      `IMAGE_TAG=${OLD_SHA} compose up -d --pull missing --no-build --remove-orphans`,
    );
    expect(await readWorkFile('.deployed-sha')).toBe(`${OLD_SHA}\n`);
    expect(result.stderr).toContain(`rolled back to ${OLD_SHA}`);
  },
  TEST_TIMEOUT_MS,
);

test('rolls back to the previous sha when the new image cannot be started', async () => {
  await writeFile(path.join(workDir, '.deployed-sha'), `${OLD_SHA}\n`);

  const result = runDeploy([NEW_SHA, BASE_PATH], OLD_SHA, NEW_SHA);

  expect(result.status).toBe(1);
  expect(await readDockerCalls()).toEqual([
    `IMAGE_TAG=${NEW_SHA} compose up -d --pull missing --no-build --remove-orphans`,
    `IMAGE_TAG=${OLD_SHA} compose up -d --pull missing --no-build --remove-orphans`,
  ]);
});

test(
  'reports a rollback that stays unhealthy',
  async () => {
    await writeFile(path.join(workDir, '.deployed-sha'), `${OLD_SHA}\n`);

    const result = runDeploy([NEW_SHA, BASE_PATH], 'unknown-sha');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`rollback to ${OLD_SHA} failed`);
  },
  TEST_TIMEOUT_MS,
);

test(
  'fails without a rollback on the first unhealthy deploy',
  async () => {
    const result = runDeploy([NEW_SHA, BASE_PATH], OLD_SHA);

    expect(result.status).toBe(1);
    expect(await readDockerCalls()).toEqual([
      `IMAGE_TAG=${NEW_SHA} compose up -d --pull missing --no-build --remove-orphans`,
    ]);
    await expect(readWorkFile('.deployed-sha')).rejects.toThrow('ENOENT');
  },
  TEST_TIMEOUT_MS,
);

test('rejects a call without arguments before touching docker', async () => {
  const result = runDeploy([], NEW_SHA);

  expect(result.status).toBe(2);
  await expect(readWorkFile('calls.log')).rejects.toThrow('ENOENT');
});

test('checks health on the app port and base path from the environment', async () => {
  runDeploy([NEW_SHA, BASE_PATH], NEW_SHA);

  expect(await readWorkFile('curl.log')).toContain(HEALTH_URL);
});

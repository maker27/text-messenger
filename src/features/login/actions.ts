'use server';

import { isIP } from 'node:net';

import { cookies, headers } from 'next/headers';

import { MESSENGERS } from '@/entities/messenger/config';
import { messengerIdSchema, type MessengerId } from '@/entities/messenger/model';
import { env } from '@/server/env';
import { createGreenApiClient } from '@/server/green-api/client';
import { checkInstanceReadiness } from '@/server/green-api/instance-readiness';
import { pollerRegistry } from '@/server/notifications/poller-registry';
import { createDemoCredentials } from '@/server/session/demo-credentials';
import { loginRateLimiter } from '@/server/session/login-rate-limiter';
import {
  deleteSession,
  readSession,
  saveSession,
  sessionModeSchema,
  type Session,
} from '@/server/session/session';
import type { GreenApiError } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

import { parseLoginForm, type LoginFormError } from './login-form-schema';

const UNKNOWN_CLIENT_KEY = 'unknown';

type LoginError = GreenApiError | LoginFormError;

interface LogoutError {
  code: 'invalidInput' | 'unauthorized';
}

// The nearest proxy appends the address it saw, while earlier entries come from the client.
async function getClientKey() {
  const forwardedFor = (await headers()).get('x-forwarded-for') ?? '';
  const clientAddress = forwardedFor.split(',').at(-1)?.trim() ?? '';

  return isIP(clientAddress) === 0 ? UNKNOWN_CLIENT_KEY : clientAddress;
}

async function replaceSession(session: Omit<Session, 'sessionId'>) {
  const cookieStore = await cookies();
  const previousSession = await readSession(cookieStore, session.messengerId);
  if (previousSession.ok) {
    pollerRegistry.disconnectSession(previousSession.data);
  }
  await saveSession(cookieStore, session);
}

async function loginWithEnteredCredentials(
  messengerId: MessengerId,
  formData: FormData,
): Promise<Result<null, LoginError>> {
  if (!env.REAL_MODE_ENABLED) {
    return { error: { code: 'realModeDisabled' }, ok: false };
  }
  const attempt = loginRateLimiter.consume(await getClientKey());
  if (!attempt.ok) {
    return attempt;
  }
  const credentials = parseLoginForm(formData);
  if (!credentials.ok) {
    return credentials;
  }

  const readiness = await checkInstanceReadiness(
    createGreenApiClient(MESSENGERS[messengerId], credentials.data),
  );
  if (!readiness.ok) {
    return readiness;
  }

  await replaceSession({ credentials: credentials.data, messengerId, mode: 'real' });
  return { data: null, ok: true };
}

export async function login(
  messengerId: unknown,
  _previousState: unknown,
  formData: FormData,
): Promise<Result<null, LoginError>> {
  const id = messengerIdSchema.safeParse(messengerId);
  const mode = sessionModeSchema.safeParse(formData.get('mode'));
  if (!id.success || !mode.success) {
    return { error: { code: 'invalidInput', fields: [] }, ok: false };
  }

  if (mode.data === 'real') {
    return loginWithEnteredCredentials(id.data, formData);
  }
  await replaceSession({
    credentials: createDemoCredentials(id.data),
    messengerId: id.data,
    mode: 'demo',
  });
  return { data: null, ok: true };
}

export async function logout(messengerId: unknown): Promise<Result<null, LogoutError>> {
  const id = messengerIdSchema.safeParse(messengerId);
  if (!id.success) {
    return { error: { code: 'invalidInput' }, ok: false };
  }

  const cookieStore = await cookies();
  const session = await readSession(cookieStore, id.data);
  if (!session.ok) {
    return { error: { code: 'unauthorized' }, ok: false };
  }
  pollerRegistry.disconnectSession(session.data);
  await deleteSession(cookieStore, id.data);
  return { data: null, ok: true };
}

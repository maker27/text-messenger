import 'server-only';

import { randomUUID } from 'node:crypto';

import { getIronSession, type CookieStore } from 'iron-session';
import { z } from 'zod';

import type { MessengerId } from '@/entities/messenger/model';
import { env } from '@/server/env';
import { getApiUrlSchema } from '@/server/green-api/api-url';
import {
  apiTokenInstanceSchema,
  idInstanceSchema,
  type GreenApiCredentials,
} from '@/server/green-api/credentials';
import { getCookiePath } from '@/shared/cookies/cookie-path';
import type { Result } from '@/shared/errors/result';

const SESSION_TTL_SECONDS = 24 * 60 * 60;

export const sessionModeSchema = z.enum(['demo', 'real']);

export type SessionMode = z.infer<typeof sessionModeSchema>;

export interface Session {
  credentials: GreenApiCredentials;
  messengerId: MessengerId;
  mode: SessionMode;
  sessionId: string;
}

interface SessionError {
  code: 'realModeDisabled' | 'unauthorized';
}

interface SessionCookie {
  apiTokenInstance: string;
  apiUrl: string;
  idInstance: string;
  messengerId: MessengerId;
  mode: SessionMode;
  sessionId: string;
}

function createSessionCookieSchema(messengerId: MessengerId) {
  return z.object({
    apiTokenInstance: apiTokenInstanceSchema,
    apiUrl: z.string(),
    idInstance: idInstanceSchema,
    messengerId: z.literal(messengerId),
    mode: sessionModeSchema,
    sessionId: z.uuid(),
  });
}

function getSessionCookieName(messengerId: MessengerId) {
  return `tm_${messengerId}`;
}

function getSessionCookie(cookies: CookieStore, messengerId: MessengerId) {
  return getIronSession<SessionCookie>(cookies, {
    cookieName: getSessionCookieName(messengerId),
    cookieOptions: { httpOnly: true, path: getCookiePath(), sameSite: 'strict', secure: true },
    password: env.SESSION_SECRET,
    ttl: SESSION_TTL_SECONDS,
  });
}

function parseSessionCookie(
  sessionCookie: unknown,
  messengerId: MessengerId,
): Result<Session, SessionError> {
  const payload = createSessionCookieSchema(messengerId).safeParse(sessionCookie);
  if (!payload.success) {
    return { error: { code: 'unauthorized' }, ok: false };
  }
  const { apiTokenInstance, idInstance, mode, sessionId } = payload.data;
  if (mode === 'real' && !env.REAL_MODE_ENABLED) {
    return { error: { code: 'realModeDisabled' }, ok: false };
  }
  const apiUrl = getApiUrlSchema().safeParse(payload.data.apiUrl);
  if (!apiUrl.success) {
    return { error: { code: 'unauthorized' }, ok: false };
  }

  return {
    data: {
      credentials: { apiTokenInstance, apiUrl: apiUrl.data, idInstance },
      messengerId,
      mode,
      sessionId,
    },
    ok: true,
  };
}

// Server Components cannot write cookies, so they read without dropping an invalid cookie.
export async function peekSession(
  cookies: CookieStore,
  messengerId: MessengerId,
): Promise<Result<Session, SessionError>> {
  return parseSessionCookie(await getSessionCookie(cookies, messengerId), messengerId);
}

export async function readSession(
  cookies: CookieStore,
  messengerId: MessengerId,
): Promise<Result<Session, SessionError>> {
  const sessionCookie = await getSessionCookie(cookies, messengerId);
  const session = parseSessionCookie(sessionCookie, messengerId);
  if (!session.ok && cookies.get(getSessionCookieName(messengerId)) !== undefined) {
    sessionCookie.destroy();
  }

  return session;
}

export async function saveSession(
  cookies: CookieStore,
  { credentials, messengerId, mode }: Omit<Session, 'sessionId'>,
): Promise<Session> {
  const session = { credentials, messengerId, mode, sessionId: randomUUID() };
  const sessionCookie = await getSessionCookie(cookies, messengerId);
  Object.assign(sessionCookie, {
    ...credentials,
    messengerId,
    mode,
    sessionId: session.sessionId,
  } satisfies SessionCookie);
  await sessionCookie.save();

  return session;
}

export async function deleteSession(cookies: CookieStore, messengerId: MessengerId) {
  const sessionCookie = await getSessionCookie(cookies, messengerId);
  sessionCookie.destroy();
}

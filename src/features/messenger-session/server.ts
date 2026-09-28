import 'server-only';

import { cookies } from 'next/headers';

import type { MessengerId } from '@/entities/messenger/model';
import { peekSession, type SessionMode } from '@/server/session/session';

export interface SessionView {
  idInstance: string;
  mode: SessionMode;
}

export async function getSessionView(messengerId: MessengerId): Promise<SessionView | null> {
  const session = await peekSession(await cookies(), messengerId);

  return session.ok
    ? { idInstance: session.data.credentials.idInstance, mode: session.data.mode }
    : null;
}

import 'server-only';

import { cookies } from 'next/headers';

import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import { createGreenApiClient } from '@/server/green-api/client';
import { peekSession } from '@/server/session/session';

export async function loadChatHistory(messengerId: MessengerId, chatId: string) {
  const session = await peekSession(await cookies(), messengerId);
  if (!session.ok) {
    return session;
  }
  return createGreenApiClient(MESSENGERS[messengerId], session.data.credentials).getChatHistory(
    chatId,
  );
}

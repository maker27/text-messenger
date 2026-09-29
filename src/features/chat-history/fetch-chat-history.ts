import { z } from 'zod';

import { chatMessageSchema, type ChatMessage } from '@/entities/message/model';
import type { MessengerId } from '@/entities/messenger/model';
import { greenApiErrorSchema, type GreenApiError } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

const HISTORY_TIMEOUT_MS = 30_000;

const historyResponseSchema = z.discriminatedUnion('ok', [
  z.object({ data: z.array(chatMessageSchema), ok: z.literal(true) }),
  z.object({ error: greenApiErrorSchema, ok: z.literal(false) }),
]);

export async function fetchChatHistory(
  messengerId: MessengerId,
  chatId: string,
  signal: AbortSignal,
): Promise<Result<ChatMessage[], GreenApiError>> {
  let body: unknown;

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/${messengerId}/chats/${encodeURIComponent(chatId)}/history`,
      {
        cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(HISTORY_TIMEOUT_MS)]),
      },
    );
    body = await response.json();
  } catch (error) {
    signal.throwIfAborted();
    return { error: mapFetchError(error), ok: false };
  }

  const history = historyResponseSchema.safeParse(body);
  return history.success ? history.data : { error: { code: 'invalidResponse' }, ok: false };
}

function mapFetchError(error: unknown): GreenApiError {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return { code: 'timeout' };
  }

  if (error instanceof TypeError) {
    return { code: 'network' };
  }

  if (error instanceof SyntaxError) {
    return { code: 'invalidResponse' };
  }

  throw error;
}

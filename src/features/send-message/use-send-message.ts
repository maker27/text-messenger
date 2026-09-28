import { startTransition } from 'react';

import type { ChatMessage } from '@/entities/message/model';
import type { MessengerId } from '@/entities/messenger/model';
import { useMessengerStore } from '@/features/messenger-session/messenger-session-provider';
import type { Result } from '@/shared/errors/result';

import { sendMessage, type SendMessageError } from './actions';

const LOCAL_ID_PREFIX = 'local:';

export function useSendMessage(messengerId: MessengerId, chatId: string) {
  const addPendingMessage = useMessengerStore((state) => state.addPendingMessage);
  const confirmMessage = useMessengerStore((state) => state.confirmMessage);
  const failMessage = useMessengerStore((state) => state.failMessage);
  const chatMessages = useMessengerStore((state) => state.messagesByChat.get(chatId));

  function deliverMessage(message: ChatMessage) {
    addPendingMessage(message);
    startTransition(async () => {
      const result = await requestSendMessage(messengerId, chatId, message.text);
      if (result.ok) {
        confirmMessage(message.idMessage, result.data.idMessage);
      } else {
        failMessage(message.idMessage);
      }
    });
  }

  function send(text: string) {
    deliverMessage({
      chatId,
      direction: 'outgoing',
      idMessage: `${LOCAL_ID_PREFIX}${crypto.randomUUID()}`,
      senderName: null,
      sentAt: Date.now(),
      status: 'pending',
      text,
    });
  }

  function retry(localId: string) {
    const message = chatMessages?.get(localId);
    if (message?.status === 'failed') {
      deliverMessage({ ...message, status: 'pending' });
    }
  }

  return { retry, send };
}

// A rejected action means the server was unreachable, which the user sees as a failed message.
async function requestSendMessage(
  messengerId: MessengerId,
  chatId: string,
  text: string,
): Promise<Result<{ idMessage: string }, SendMessageError>> {
  try {
    return await sendMessage(messengerId, chatId, text);
  } catch {
    return { error: { code: 'network' }, ok: false };
  }
}

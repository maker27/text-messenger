'use client';

import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import { Composer } from '@/features/send-message/composer';
import { useSendMessage } from '@/features/send-message/use-send-message';

import { MessageList } from './message-list';

interface ChatConversationProps {
  chatId: string;
  messengerId: MessengerId;
}

export function ChatConversation({ chatId, messengerId }: ChatConversationProps) {
  const { retry, send } = useSendMessage(messengerId, chatId);

  return (
    <>
      <MessageList chatId={chatId} onMessageRetry={retry} />
      <Composer
        maxMessageLength={MESSENGERS[messengerId].maxMessageLength}
        onMessageSubmit={send}
      />
    </>
  );
}

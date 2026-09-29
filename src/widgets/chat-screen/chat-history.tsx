'use client';

import type { MessengerId } from '@/entities/messenger/model';
import { useChatHistory } from '@/features/chat-history/use-chat-history';

import { ChatConversation } from './chat-conversation';
import { ChatScreenSkeleton } from './chat-screen-skeleton';
import { HistoryError } from './history-error';

interface ChatHistoryProps {
  chatId: string;
  messengerId: MessengerId;
}

export function ChatHistory({ chatId, messengerId }: ChatHistoryProps) {
  const { error, isLoaded, retry } = useChatHistory(messengerId, chatId);

  if (!isLoaded) {
    return error === null ? (
      <ChatScreenSkeleton />
    ) : (
      <HistoryError className="flex-1" error={error} messengerId={messengerId} onRetry={retry} />
    );
  }

  return (
    <>
      {error !== null && (
        <HistoryError
          className="border-b border-border"
          error={error}
          messengerId={messengerId}
          onRetry={retry}
        />
      )}
      <ChatConversation chatId={chatId} messengerId={messengerId} />
    </>
  );
}

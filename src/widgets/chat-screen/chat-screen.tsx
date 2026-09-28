import { Suspense } from 'react';

import type { MessengerId } from '@/entities/messenger/model';
import { HistoryHydrator } from '@/features/chat-history/history-hydrator';
import { loadChatHistory } from '@/features/chat-history/server';

import { ChatConversation } from './chat-conversation';
import { ChatHeader } from './chat-header';
import { ChatScreenSkeleton } from './chat-screen-skeleton';
import { HistoryError } from './history-error';

interface ChatScreenProps {
  chatId: string;
  messenger: MessengerId;
}

export function ChatScreen({ chatId, messenger }: ChatScreenProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <ChatHeader chatId={chatId} messengerId={messenger} />
      <Suspense key={chatId} fallback={<ChatScreenSkeleton />}>
        <ChatHistory chatId={chatId} messenger={messenger} />
      </Suspense>
    </section>
  );
}

async function ChatHistory({ chatId, messenger }: ChatScreenProps) {
  const history = await loadChatHistory(messenger, chatId);

  if (!history.ok) {
    return <HistoryError error={history.error} messengerId={messenger} />;
  }

  return (
    <>
      <HistoryHydrator chatId={chatId} messages={history.data} />
      <ChatConversation chatId={chatId} messengerId={messenger} />
    </>
  );
}

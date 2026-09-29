import type { MessengerId } from '@/entities/messenger/model';

import { ChatHeader } from './chat-header';
import { ChatHistory } from './chat-history';

interface ChatScreenProps {
  chatId: string;
  messenger: MessengerId;
}

export function ChatScreen({ chatId, messenger }: ChatScreenProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ChatHeader chatId={chatId} messengerId={messenger} />
      <ChatHistory key={chatId} chatId={chatId} messengerId={messenger} />
    </section>
  );
}

'use client';

import Link from 'next/link';

import { ChatAvatar } from '@/entities/chat/chat-avatar';
import { getChatPath } from '@/entities/chat/chat-path';
import type { MessengerId } from '@/entities/messenger/model';
import { useMessengerStore } from '@/features/messenger-session/messenger-session-provider';

interface ChatListProps {
  messengerId: MessengerId;
}

export function ChatList({ messengerId }: ChatListProps) {
  const activeChatId = useMessengerStore((state) => state.activeChatId);
  const chats = useMessengerStore((state) => state.chats);
  const unreadByChat = useMessengerStore((state) => state.unreadByChat);

  if (chats.length === 0) {
    return <p className="text-sm text-text-muted">Создайте чат по номеру телефона</p>;
  }

  return (
    <nav aria-label="Чаты">
      <ul className="flex flex-col">
        {chats.map(({ chatId, title }) => {
          const unreadCount = unreadByChat.get(chatId) ?? 0;

          return (
            <li key={chatId}>
              <Link
                aria-current={chatId === activeChatId ? 'page' : undefined}
                className="flex h-[var(--row-height)] items-center gap-3 px-3 outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus aria-[current=page]:bg-row-active aria-[current=page]:text-on-row-active"
                href={getChatPath(messengerId, chatId)}
              >
                <ChatAvatar chatId={chatId} title={title} />
                <span className="min-w-0 flex-1 truncate" title={title}>
                  {title}
                </span>
                {unreadCount > 0 && (
                  <>
                    <span
                      aria-hidden
                      className="rounded-full bg-accent px-2 text-xs leading-5 text-on-accent"
                    >
                      {unreadCount}
                    </span>
                    <span className="sr-only">{`, ${String(unreadCount)} непрочитанных`}</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

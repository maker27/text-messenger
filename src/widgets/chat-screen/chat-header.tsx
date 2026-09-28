'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { ChatAvatar } from '@/entities/chat/chat-avatar';
import type { MessengerId } from '@/entities/messenger/model';
import { useMessengerStore } from '@/features/messenger-session/messenger-session-provider';

interface ChatHeaderProps {
  chatId: string;
  messengerId: MessengerId;
}

export function ChatHeader({ chatId, messengerId }: ChatHeaderProps) {
  const setActiveChat = useMessengerStore((state) => state.setActiveChat);
  const title = useMessengerStore(
    (state) => state.chats.find((chat) => chat.chatId === chatId)?.title ?? chatId,
  );

  useEffect(() => {
    setActiveChat(chatId);
    return () => {
      setActiveChat(null);
    };
  }, [chatId, setActiveChat]);

  return (
    <header className="flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      <Link
        className="flex size-10 shrink-0 items-center justify-center rounded-md outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus md:hidden"
        href={`/${messengerId}`}
      >
        <ArrowLeft aria-hidden className="size-5" />
        <span className="sr-only">Назад к чатам</span>
      </Link>
      <ChatAvatar chatId={chatId} isHeader title={title} />
      <h3 className="min-w-0 truncate font-semibold" title={title}>
        {title}
      </h3>
    </header>
  );
}

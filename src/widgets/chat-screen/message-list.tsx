'use client';

import { useLayoutEffect, useRef } from 'react';

import { getMessageGroupPosition } from '@/entities/message/message-group';
import { selectChatMessages } from '@/entities/message/messenger-store';
import { useMessengerStore } from '@/features/messenger-session/messenger-session-provider';

import { MessageBubble } from './message-bubble';

const BOTTOM_THRESHOLD_PX = 48;

interface MessageListProps {
  chatId: string;
  isOffline: boolean;
  onMessageRetry: (localId: string) => void;
}

export function MessageList({ chatId, isOffline, onMessageRetry }: MessageListProps) {
  const messages = useMessengerStore(selectChatMessages(chatId));
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (container !== null && isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  function handleListScroll() {
    const container = scrollRef.current;
    if (container !== null) {
      isAtBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight <=
        BOTTOM_THRESHOLD_PX;
    }
  }

  return (
    <div className="chat-wallpaper flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="relative flex min-h-0 flex-1 flex-col overflow-y-auto"
        onScroll={handleListScroll}
      >
        <div aria-live="polite" aria-relevant="additions" className="flex flex-1 flex-col">
          {messages.length === 0 ? (
            <p className="flex flex-1 items-center justify-center text-text-muted">
              Сообщений пока нет
            </p>
          ) : (
            <ol className="flex flex-col gap-0.5 p-3">
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.idMessage}
                  groupPosition={getMessageGroupPosition(messages, index)}
                  isOffline={isOffline}
                  message={message}
                  onMessageRetry={onMessageRetry}
                />
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

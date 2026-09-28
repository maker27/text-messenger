import type { ReactNode } from 'react';

import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import { ChatList } from '@/features/chat-list/chat-list';
import { ConnectionStatus } from '@/features/connection-status/connection-status';
import { CreateChatForm } from '@/features/create-chat/create-chat-form';
import { LogoutButton } from '@/features/login/logout-button';
import { SessionGate } from '@/features/messenger-session/session-gate';
import { roboto } from '@/shared/fonts/fonts';

interface MessengerFaceProps {
  chat: ReactNode | null;
  messenger: MessengerId;
}

export function MessengerFace({ chat, messenger }: MessengerFaceProps) {
  return (
    <div className={`${roboto.variable} flex h-full flex-col`} data-messenger={messenger}>
      <h2 className="sr-only outline-none" tabIndex={-1}>
        {MESSENGERS[messenger].title}
      </h2>
      <SessionGate messengerId={messenger}>
        <div className="flex min-h-0 flex-1">
          <div
            className={`${chat === null ? 'flex' : 'hidden md:flex'} min-h-0 w-full flex-col md:w-[var(--sidebar-width)] md:max-w-[var(--sidebar-width-max,none)] md:min-w-[var(--sidebar-width-min)] md:shrink-0 md:border-r md:border-border`}
          >
            <header className="flex h-[var(--header-height)] shrink-0 items-center justify-between gap-2 border-b border-border px-3">
              <ConnectionStatus messengerId={messenger} />
              <LogoutButton messengerId={messenger} />
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
              <CreateChatForm messengerId={messenger} />
              <ChatList messengerId={messenger} />
            </div>
          </div>
          {chat ?? (
            <div className="chat-wallpaper chat-empty-panel hidden flex-1 items-center justify-center md:flex">
              <p className="empty-chat-hint rounded-full bg-surface/80 px-4 py-2 text-sm text-text-muted shadow-sm">
                Выберите чат
              </p>
            </div>
          )}
        </div>
      </SessionGate>
    </div>
  );
}

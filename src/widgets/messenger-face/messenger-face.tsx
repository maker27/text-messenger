import type { ReactNode } from 'react';

import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import { ChatList } from '@/features/chat-list/chat-list';
import { ConnectionStatus } from '@/features/connection-status/connection-status';
import { CreateChatForm } from '@/features/create-chat/create-chat-form';
import { LogoutButton } from '@/features/login/logout-button';
import { SessionGate } from '@/features/messenger-session/session-gate';
import { roboto } from '@/shared/fonts/fonts';

import { FaceSidebar } from './face-sidebar';

interface MessengerFaceProps {
  children: ReactNode;
  messenger: MessengerId;
}

export function MessengerFace({ children, messenger }: MessengerFaceProps) {
  return (
    <div className={`${roboto.variable} flex h-full flex-col`} data-messenger={messenger}>
      <h2 className="sr-only outline-none" tabIndex={-1}>
        {MESSENGERS[messenger].title}
      </h2>
      <SessionGate messengerId={messenger}>
        <div className="flex min-h-0 flex-1">
          <FaceSidebar>
            <header className="flex h-[var(--header-height)] shrink-0 items-center justify-between gap-2 border-b border-border px-3">
              <ConnectionStatus messengerId={messenger} />
              <LogoutButton messengerId={messenger} />
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
              <CreateChatForm messengerId={messenger} />
              <ChatList messengerId={messenger} />
            </div>
          </FaceSidebar>
          {children}
        </div>
      </SessionGate>
    </div>
  );
}

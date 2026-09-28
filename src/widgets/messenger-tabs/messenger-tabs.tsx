'use client';

import Link from 'next/link';

import { MESSENGER_ORDER, MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';

import { MaxLogo } from './logos/max-logo';
import { TelegramLogo } from './logos/telegram-logo';
import { WhatsappLogo } from './logos/whatsapp-logo';

const Logo = {
  max: MaxLogo,
  telegram: TelegramLogo,
  whatsapp: WhatsappLogo,
} satisfies Record<MessengerId, unknown>;

interface MessengerTabsProps {
  activeMessenger: MessengerId | null;
  tabPaths: Record<MessengerId, string>;
  unreadByMessenger: Record<MessengerId, number>;
}

export function MessengerTabs({
  activeMessenger,
  tabPaths,
  unreadByMessenger,
}: MessengerTabsProps) {
  return (
    <nav aria-label="Мессенджеры" className="min-w-0 flex-1">
      <ul className="flex">
        {MESSENGER_ORDER.map((messengerId) => {
          const MessengerLogo = Logo[messengerId];
          const unreadCount = unreadByMessenger[messengerId];
          const isActive = messengerId === activeMessenger;

          return (
            <li key={messengerId} className="flex-1" data-messenger={messengerId}>
              <Link
                aria-current={isActive ? 'page' : undefined}
                className="flex min-h-12 items-center justify-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset aria-[current=page]:border-accent aria-[current=page]:text-text"
                href={tabPaths[messengerId]}
              >
                <MessengerLogo className="size-5 shrink-0 text-accent" />
                <span>
                  <span className="sr-only sm:not-sr-only">{MESSENGERS[messengerId].title}</span>
                  {messengerId === 'whatsapp' && <span aria-hidden>*</span>}
                </span>
                {unreadCount > 0 && (
                  <span
                    aria-label={`${String(unreadCount)} непрочитанных`}
                    className="min-w-5 rounded-full bg-accent px-1.5 text-center text-xs leading-5 text-on-accent"
                  >
                    {unreadCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

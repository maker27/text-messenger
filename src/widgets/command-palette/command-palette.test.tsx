import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Chat } from '@/entities/chat/model';
import {
  MessengerSessionProvider,
  useMessengerStore,
} from '@/features/messenger-session/messenger-session-provider';
import type { SessionView } from '@/features/messenger-session/server';
import { SessionGate } from '@/features/messenger-session/session-gate';

import { CommandPalette } from './command-palette';

const MAX_SESSION: SessionView = { idInstance: '3100000000000001', mode: 'demo' };
const TELEGRAM_SESSION: SessionView = { idInstance: '4100000000000001', mode: 'demo' };
const TAB_PATHS = { max: '/max', telegram: '/telegram/79160000000', whatsapp: '/whatsapp' };
const TELEGRAM_CHATS: Chat[] = [
  { chatId: '79161111111', lastMessageAt: null, title: 'Анна' },
  { chatId: '79162222222', lastMessageAt: null, title: 'Борис' },
];

const { logout, push, refresh } = vi.hoisted(() => ({
  logout: vi.fn(() => Promise.resolve({ data: null, ok: true })),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  usePathname: () => '/max',
  useRouter: () => ({ push, refresh }),
}));

vi.mock('@/features/login/actions', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  logout,
}));

class FakeEventSource extends EventTarget {
  static readonly CLOSED = 2;

  readyState = 0;

  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
}

interface ChatSeedProps {
  chats: Chat[];
}

function ChatSeed({ chats }: ChatSeedProps) {
  const addChat = useMessengerStore((state) => state.addChat);

  useEffect(() => {
    chats.forEach(addChat);
  }, [addChat, chats]);

  return null;
}

interface PaletteHarnessProps {
  onThemeChange: () => void;
}

function PaletteHarness({ onThemeChange }: PaletteHarnessProps) {
  return (
    <MessengerSessionProvider isRealModeEnabled={false} messengerId="max" session={MAX_SESSION}>
      <MessengerSessionProvider isRealModeEnabled={false} messengerId="whatsapp" session={null}>
        <MessengerSessionProvider
          isRealModeEnabled={false}
          messengerId="telegram"
          session={TELEGRAM_SESSION}
        >
          <SessionGate messengerId="telegram">
            <ChatSeed chats={TELEGRAM_CHATS} />
          </SessionGate>
          <section data-messenger="max">
            <input aria-label="Номер телефона" name="phone" />
          </section>
          <button type="button">Кнопка</button>
          <CommandPalette
            activeMessenger="max"
            tabPaths={TAB_PATHS}
            onThemeChange={onThemeChange}
          />
        </MessengerSessionProvider>
      </MessengerSessionProvider>
    </MessengerSessionProvider>
  );
}

async function openPalette() {
  const onThemeChange = vi.fn();
  render(<PaletteHarness onThemeChange={onThemeChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Кнопка' }));
  await userEvent.keyboard('{Control>}k{/Control}');
  await screen.findByRole('dialog', { name: 'Палитра команд' });
  return { onThemeChange };
}

beforeEach(() => {
  vi.stubGlobal('EventSource', FakeEventSource);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('filters the chats by the search text', async () => {
  await openPalette();

  await userEvent.keyboard('анн');

  expect(await screen.findByRole('menuitem', { name: 'Анна' })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: 'Борис' })).toBeNull();
  expect(screen.queryByRole('menuitem', { name: 'MAX' })).toBeNull();
});

test('shows an empty state when nothing matches', async () => {
  await openPalette();

  await userEvent.keyboard('яяя');

  expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
});

test('opens the selected chat and closes the palette', async () => {
  await openPalette();

  await userEvent.click(await screen.findByRole('menuitem', { name: 'Борис' }));

  expect(push).toHaveBeenCalledExactlyOnceWith('/telegram/79162222222');
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

test('switches to the last path of a messenger', async () => {
  await openPalette();

  await userEvent.click(screen.getByRole('menuitem', { name: 'Telegram' }));

  expect(push).toHaveBeenCalledExactlyOnceWith('/telegram/79160000000');
});

test('offers to log out only of messengers with a session', async () => {
  await openPalette();

  expect(screen.getByRole('menuitem', { name: 'Выйти из MAX' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Выйти из Telegram' })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: 'Выйти из WhatsApp' })).toBeNull();
});

test('logs out of the selected messenger', async () => {
  await openPalette();

  await userEvent.click(screen.getByRole('menuitem', { name: 'Выйти из MAX' }));

  await waitFor(() => {
    expect(refresh).toHaveBeenCalledOnce();
  });
  expect(logout).toHaveBeenCalledExactlyOnceWith('max');
});

test('changes the theme', async () => {
  const { onThemeChange } = await openPalette();

  await userEvent.click(screen.getByRole('menuitem', { name: 'Тема: Тёмная' }));

  expect(onThemeChange).toHaveBeenCalledExactlyOnceWith('dark');
});

test('moves the focus to the phone field of the active face for a new chat', async () => {
  await openPalette();

  await userEvent.click(screen.getByRole('menuitem', { name: 'Новый чат' }));

  await waitFor(() => {
    expect(screen.getByRole('textbox', { name: 'Номер телефона' })).toHaveFocus();
  });
});

test('returns the focus to where the palette was opened on Escape', async () => {
  await openPalette();

  await userEvent.keyboard('{Escape}');

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Кнопка' })).toHaveFocus();
  });
  expect(screen.queryByRole('dialog')).toBeNull();
});

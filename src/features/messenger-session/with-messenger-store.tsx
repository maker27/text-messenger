import type { Decorator } from '@storybook/nextjs-vite';
import { useState, type ReactNode } from 'react';

import { createMessengerStore } from '@/entities/message/messenger-store';
import { MemoryStorage } from '@/shared/testing/memory-storage';

import { MessengerStoreContext } from './messenger-session-provider';

type MessengerStore = ReturnType<typeof createMessengerStore>;

interface StoryStoreProviderProps {
  children: ReactNode;
  setup: (store: MessengerStore) => void;
  storage: Storage;
}

function StoryStoreProvider({ children, setup, storage }: StoryStoreProviderProps) {
  const [store] = useState(() => {
    const messengerStore = createMessengerStore({
      idInstance: '1101000000000001',
      messengerId: 'max',
      storage,
    });
    setup(messengerStore);
    return messengerStore;
  });

  return <MessengerStoreContext value={store}>{children}</MessengerStoreContext>;
}

export function withMessengerStore(
  setup: (store: MessengerStore) => void,
  storage: Storage = new MemoryStorage(),
): Decorator {
  return function MessengerStoreDecorator(Story) {
    return (
      <StoryStoreProvider setup={setup} storage={storage}>
        <Story />
      </StoryStoreProvider>
    );
  };
}

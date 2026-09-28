'use client';

import { useLayoutEffect } from 'react';

import type { ChatMessage } from '@/entities/message/model';
import { useMessengerStore } from '@/features/messenger-session/messenger-session-provider';

interface HistoryHydratorProps {
  chatId: string;
  messages: ChatMessage[];
}

export function HistoryHydrator({ chatId, messages }: HistoryHydratorProps) {
  const hydrateHistory = useMessengerStore((state) => state.hydrateHistory);

  // A layout effect keeps the empty state from flashing before the loaded history is painted.
  useLayoutEffect(() => {
    hydrateHistory(chatId, messages);
  }, [chatId, hydrateHistory, messages]);

  return null;
}

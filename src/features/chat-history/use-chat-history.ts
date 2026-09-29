'use client';

import { useEffect, useState } from 'react';

import { selectHistoryState } from '@/entities/message/messenger-store';
import type { MessengerId } from '@/entities/messenger/model';
import { useMessengerStore } from '@/features/messenger-session/messenger-session-provider';
import type { GreenApiError } from '@/shared/errors/model';

import { fetchChatHistory } from './fetch-chat-history';

export function useChatHistory(messengerId: MessengerId, chatId: string) {
  const historyState = useMessengerStore(selectHistoryState(chatId));
  const historyVersion = useMessengerStore((state) => state.historyVersion);
  const hydrateHistory = useMessengerStore((state) => state.hydrateHistory);
  const isCleared = useMessengerStore((state) => state.isCleared);
  const [error, setError] = useState<GreenApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // A cleared store belongs to a session that is ending, so there is nobody to load for.
    if (historyState === 'current' || isCleared) {
      return;
    }

    const controller = new AbortController();

    fetchChatHistory(messengerId, chatId, controller.signal).then(
      (history) => {
        if (history.ok) {
          hydrateHistory(chatId, history.data);
          setError(null);
        } else {
          setError(history.error);
        }
      },
      (reason: unknown) => {
        if (!controller.signal.aborted) {
          throw reason;
        }
      },
    );

    return () => {
      controller.abort();
    };
  }, [attempt, chatId, historyState, historyVersion, hydrateHistory, isCleared, messengerId]);

  function retry() {
    setError(null);
    setAttempt(attempt + 1);
  }

  return { error, isLoaded: historyState !== 'missing', retry };
}

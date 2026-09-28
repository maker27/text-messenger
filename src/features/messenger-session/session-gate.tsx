'use client';

import type { ReactNode } from 'react';

import type { MessengerId } from '@/entities/messenger/model';
import { LoginScreen } from '@/features/login/login-screen';

import { MessengerStoreContext, useMessengerSession } from './messenger-session-provider';

interface SessionGateProps {
  children: ReactNode;
  messengerId: MessengerId;
}

export function SessionGate({ children, messengerId }: SessionGateProps) {
  const { isRealModeEnabled, loginReason, session, store } = useMessengerSession(messengerId);

  if (session === null) {
    return (
      <LoginScreen
        isRealModeEnabled={isRealModeEnabled}
        messengerId={messengerId}
        reason={loginReason}
      />
    );
  }

  if (store === null) {
    return (
      <p className="p-4" role="status">
        Загрузка…
      </p>
    );
  }

  return <MessengerStoreContext value={store}>{children}</MessengerStoreContext>;
}

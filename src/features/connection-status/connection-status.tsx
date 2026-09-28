'use client';

import { useEffect, useState } from 'react';

import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import { useMessengerStore } from '@/features/messenger-session/messenger-session-provider';
import { getGreenApiErrorMessage, getLoginReasonMessage } from '@/shared/errors/messages';

const SECOND_MS = 1000;

interface ConnectionStatusProps {
  messengerId: MessengerId;
}

export function ConnectionStatus({ messengerId }: ConnectionStatusProps) {
  const connection = useMessengerStore((state) => state.connection);
  const messengerTitle = MESSENGERS[messengerId].title;

  return (
    <p className="text-sm text-text-muted" role="status">
      {connection.status === 'connecting' && 'Подключение…'}
      {connection.status === 'online' && 'В сети'}
      {connection.status === 'reconnecting' && (
        <ReconnectCountdown key={connection.retryAt} retryAt={connection.retryAt} />
      )}
      {connection.status === 'stopped' &&
        (connection.code === null
          ? 'Получение сообщений остановлено'
          : getGreenApiErrorMessage({ code: connection.code }, messengerTitle))}
      {connection.status === 'unauthorized' &&
        getLoginReasonMessage('sessionExpired', messengerTitle)}
    </p>
  );
}

interface ReconnectCountdownProps {
  retryAt: number;
}

function ReconnectCountdown({ retryAt }: ReconnectCountdownProps) {
  const [now, setNow] = useState(Date.now);
  const seconds = Math.max(0, Math.ceil((retryAt - now) / SECOND_MS));

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, SECOND_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return <>Переподключение через {seconds} с</>;
}

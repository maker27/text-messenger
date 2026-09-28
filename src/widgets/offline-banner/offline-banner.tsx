'use client';

import { useOnlineStatus } from '@/shared/network/use-online-status';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  return (
    <div role="status">
      {!isOnline && (
        <p className="border-b border-border bg-surface-muted px-4 py-2 text-sm text-danger">
          Нет подключения к интернету. Отправка недоступна
        </p>
      )}
    </div>
  );
}

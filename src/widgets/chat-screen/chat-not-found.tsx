import Link from 'next/link';

import type { MessengerId } from '@/entities/messenger/model';

interface ChatNotFoundProps {
  messenger: MessengerId;
}

export function ChatNotFound({ messenger }: ChatNotFoundProps) {
  return (
    <section className="flex min-w-0 flex-1 flex-col items-start gap-4 p-3">
      <h3 className="font-semibold">Чат не найден</h3>
      <Link
        className="rounded-md font-medium text-accent-button outline-none focus-visible:ring-2 focus-visible:ring-focus"
        href={`/${messenger}`}
      >
        Вернуться к чатам
      </Link>
    </section>
  );
}

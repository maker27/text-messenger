'use client';

import { UNEXPECTED_ERROR_MESSAGE } from '@/shared/errors/messages';

import './globals.css';

interface GlobalErrorProps {
  retry: () => void;
}

export default function GlobalError({ retry }: GlobalErrorProps) {
  return (
    <html className="h-full antialiased" lang="ru">
      <body className="flex h-full flex-col">
        <title>Ошибка — Multi Messenger</title>
        <main className="flex flex-col items-start gap-4 p-4" role="alert">
          <h1 className="text-lg font-semibold">Что-то пошло не так</h1>
          <p>{UNEXPECTED_ERROR_MESSAGE}</p>
          <button
            className="rounded-md border border-border px-4 py-2 font-medium text-accent-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
            type="button"
            onClick={retry}
          >
            Обновить
          </button>
        </main>
      </body>
    </html>
  );
}

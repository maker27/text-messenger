import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Конфиденциальность',
};

export default function PrivacyPage() {
  return (
    <article className="flex max-w-2xl flex-1 flex-col items-start gap-4 p-4 text-sm">
      <h1 className="text-lg font-semibold">Конфиденциальность</h1>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Какие данные</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            Данные инстанса GREEN-API — idInstance и apiTokenInstance — в отдельной зашифрованной
            cookie для каждого мессенджера, недоступной скриптам страницы.
          </li>
          <li>
            Список чатов — идентификатор чата, название и время последнего сообщения — в хранилище
            браузера.
          </li>
          <li>Тексты сообщений — передаются через сервер приложения в GREEN-API транзитом.</li>
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Зачем</h2>
        <p>Только для отправки и получения текстовых сообщений через API GREEN-API.</p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Сколько хранятся</h2>
        <p>
          Cookie с данными инстанса живёт 24 часа и удаляется при выходе. Список чатов хранится в
          браузере до выхода. Сообщения находятся в памяти вкладки и пропадают после её закрытия.
          Выбранная тема хранится в cookie один год.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Что не хранится</h2>
        <p>
          Сервер приложения не сохраняет номера телефонов, тексты сообщений и данные инстанса и не
          записывает их в журналы.
        </p>
      </section>
      <Link
        className="rounded-md font-medium text-accent-text outline-none focus-visible:ring-2 focus-visible:ring-focus"
        href="/"
      >
        Назад
      </Link>
    </article>
  );
}

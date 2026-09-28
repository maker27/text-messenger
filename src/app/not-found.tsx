import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-start gap-4 p-4">
      <h1 className="text-lg font-semibold">Страница не найдена</h1>
      <Link
        className="rounded-md font-medium text-accent-button outline-none focus-visible:ring-2 focus-visible:ring-focus"
        href="/max"
      >
        Перейти к MAX
      </Link>
    </div>
  );
}

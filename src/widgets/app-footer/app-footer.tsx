import Link from 'next/link';

interface AppFooterProps {
  isDemo: boolean;
}

export function AppFooter({ isDemo }: AppFooterProps) {
  return (
    <footer className="flex shrink-0 flex-col gap-1 border-t border-border bg-surface-muted px-4 py-2 text-xs text-text-muted">
      <p>
        {isDemo && <span className="font-medium text-text">Демонстрационная версия. </span>}
        Приложение не соединяется с серверами мессенджеров напрямую — все запросы идут через API
        GREEN-API.{' '}
        <Link
          className="rounded-sm font-medium text-accent-text underline outline-none focus-visible:ring-2 focus-visible:ring-focus"
          href="/privacy"
        >
          Конфиденциальность
        </Link>
      </p>
      <p>
        * WhatsApp принадлежит компании Meta Platforms Inc., деятельность которой признана
        экстремистской и запрещена на территории РФ
      </p>
    </footer>
  );
}

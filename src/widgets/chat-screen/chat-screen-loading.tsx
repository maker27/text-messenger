import { ChatScreenSkeleton } from './chat-screen-skeleton';

export function ChatScreenLoading() {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header
        aria-hidden
        className="flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b border-border bg-surface px-3"
      >
        <span className="size-[var(--avatar-size-header)] shrink-0 animate-pulse rounded-full bg-surface-muted" />
        <span className="h-4 w-32 animate-pulse rounded bg-surface-muted" />
      </header>
      <ChatScreenSkeleton />
    </section>
  );
}

const SKELETON_BUBBLE_CLASS_NAMES = ['w-2/3 self-start', 'w-1/2 self-end', 'w-3/5 self-start'];

export function ChatScreenSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-2 p-3" role="status">
      <span className="sr-only">Загрузка сообщений</span>
      {SKELETON_BUBBLE_CLASS_NAMES.map((className) => (
        <div
          key={className}
          aria-hidden
          className={`h-12 animate-pulse rounded-lg bg-surface-muted ${className}`}
        />
      ))}
    </div>
  );
}

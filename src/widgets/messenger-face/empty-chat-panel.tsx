export function EmptyChatPanel() {
  return (
    <div className="chat-wallpaper chat-empty-panel hidden flex-1 items-center justify-center md:flex">
      <p className="empty-chat-hint rounded-full bg-surface/80 px-4 py-2 text-sm text-text-muted shadow-sm">
        Выберите чат
      </p>
    </div>
  );
}

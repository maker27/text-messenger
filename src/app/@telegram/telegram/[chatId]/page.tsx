import { notFound } from 'next/navigation';

import { parseRouteChatId } from '@/server/green-api/chat-id';
import { ChatScreen } from '@/widgets/chat-screen/chat-screen';

export default async function Page({ params }: PageProps<'/telegram/[chatId]'>) {
  const chatId = parseRouteChatId('telegram', (await params).chatId);

  if (chatId === null) {
    notFound();
  }

  return <ChatScreen chatId={chatId} messenger="telegram" />;
}

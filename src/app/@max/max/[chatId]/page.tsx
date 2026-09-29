import { notFound } from 'next/navigation';

import { parseRouteChatId } from '@/server/green-api/chat-id';
import { ChatScreen } from '@/widgets/chat-screen/chat-screen';

export default async function Page({ params }: PageProps<'/max/[chatId]'>) {
  const chatId = parseRouteChatId('max', (await params).chatId);

  if (chatId === null) {
    notFound();
  }

  return <ChatScreen chatId={chatId} messenger="max" />;
}

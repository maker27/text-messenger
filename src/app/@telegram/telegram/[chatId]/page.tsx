import { notFound } from 'next/navigation';

import { parseRouteChatId } from '@/server/green-api/chat-id';
import { ChatScreen } from '@/widgets/chat-screen/chat-screen';
import { MessengerFace } from '@/widgets/messenger-face/messenger-face';

export default async function Page({ params }: PageProps<'/telegram/[chatId]'>) {
  const chatId = parseRouteChatId('telegram', (await params).chatId);

  if (chatId === null) {
    notFound();
  }

  return (
    <MessengerFace
      chat={<ChatScreen chatId={chatId} messenger="telegram" />}
      messenger="telegram"
    />
  );
}

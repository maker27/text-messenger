import { ChatNotFound } from '@/widgets/chat-screen/chat-not-found';
import { MessengerFace } from '@/widgets/messenger-face/messenger-face';

export default function NotFound() {
  return <MessengerFace chat={<ChatNotFound messenger="telegram" />} messenger="telegram" />;
}

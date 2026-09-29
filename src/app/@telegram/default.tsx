import { EmptyChatPanel } from '@/widgets/messenger-face/empty-chat-panel';
import { MessengerFace } from '@/widgets/messenger-face/messenger-face';

export default function Default() {
  return (
    <MessengerFace messenger="telegram">
      <EmptyChatPanel />
    </MessengerFace>
  );
}

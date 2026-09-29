import { MessengerFace } from '@/widgets/messenger-face/messenger-face';

export default function Layout({ children }: LayoutProps<'/whatsapp'>) {
  return <MessengerFace messenger="whatsapp">{children}</MessengerFace>;
}

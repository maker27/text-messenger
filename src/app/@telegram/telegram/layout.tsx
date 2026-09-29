import { MessengerFace } from '@/widgets/messenger-face/messenger-face';

export default function Layout({ children }: LayoutProps<'/telegram'>) {
  return <MessengerFace messenger="telegram">{children}</MessengerFace>;
}

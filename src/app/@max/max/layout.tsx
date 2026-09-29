import { MessengerFace } from '@/widgets/messenger-face/messenger-face';

export default function Layout({ children }: LayoutProps<'/max'>) {
  return <MessengerFace messenger="max">{children}</MessengerFace>;
}

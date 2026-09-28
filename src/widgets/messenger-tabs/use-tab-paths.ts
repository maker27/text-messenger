import { usePathname } from 'next/navigation';
import { useState } from 'react';

import type { MessengerId } from '@/entities/messenger/model';

const INITIAL_TAB_PATHS: Record<MessengerId, string> = {
  max: '/max',
  telegram: '/telegram',
  whatsapp: '/whatsapp',
};

export function useTabPaths(activeMessenger: MessengerId | null) {
  const pathname = usePathname();
  const [tabPaths, setTabPaths] = useState(INITIAL_TAB_PATHS);

  if (activeMessenger !== null && tabPaths[activeMessenger] !== pathname) {
    setTabPaths({ ...tabPaths, [activeMessenger]: pathname });
  }

  return tabPaths;
}

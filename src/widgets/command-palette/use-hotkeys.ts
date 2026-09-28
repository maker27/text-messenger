import { useEffect, useEffectEvent } from 'react';

import { MESSENGER_ORDER } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';

const PALETTE_KEY_CODE = 'KeyK';

// Physical key codes keep the shortcuts working in any keyboard layout.
const TAB_BY_KEY_CODE = new Map<string, MessengerId>(
  MESSENGER_ORDER.map((messengerId, index) => [`Digit${String(index + 1)}`, messengerId]),
);

interface HotkeysOptions {
  onPaletteOpen: () => void;
  onTabSelect: (messengerId: MessengerId) => void;
}

export function useHotkeys({ onPaletteOpen, onTabSelect }: HotkeysOptions) {
  const handleWindowKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.altKey || event.shiftKey || event.isComposing) {
      return;
    }

    const tab = TAB_BY_KEY_CODE.get(event.code);

    // Repeats of a held shortcut stay blocked so the browser default does not fire either.
    if (tab !== undefined && event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      if (!event.repeat) {
        onTabSelect(tab);
      }
    } else if (event.code === PALETTE_KEY_CODE && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (!event.repeat) {
        onPaletteOpen();
      }
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      handleWindowKeyDown(event);
    };
    window.addEventListener('keydown', listener);

    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, []);
}

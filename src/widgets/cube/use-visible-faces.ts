import { useState } from 'react';

import { MESSENGER_ORDER } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

interface VisibleFaces {
  activeMessenger: MessengerId;
  faces: readonly MessengerId[];
  isSettled: boolean;
}

export function useVisibleFaces(activeMessenger: MessengerId) {
  const [visible, setVisible] = useState<VisibleFaces>({
    activeMessenger,
    faces: [activeMessenger],
    isSettled: false,
  });

  if (visible.activeMessenger !== activeMessenger) {
    const isMotionReduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;

    setVisible({
      activeMessenger,
      faces: isMotionReduced
        ? [activeMessenger]
        : addPathFaces(visible.faces, visible.activeMessenger, activeMessenger),
      isSettled: isMotionReduced,
    });
  }

  const settleFaces = () => {
    setVisible({ activeMessenger, faces: [activeMessenger], isSettled: true });
  };

  return { faces: visible.faces, isSettled: visible.isSettled, settleFaces };
}

function addPathFaces(faces: readonly MessengerId[], from: MessengerId, to: MessengerId) {
  const fromIndex = MESSENGER_ORDER.indexOf(from);
  const toIndex = MESSENGER_ORDER.indexOf(to);
  const pathFaces = MESSENGER_ORDER.slice(
    Math.min(fromIndex, toIndex),
    Math.max(fromIndex, toIndex) + 1,
  );

  return MESSENGER_ORDER.filter(
    (messengerId) => faces.includes(messengerId) || pathFaces.includes(messengerId),
  );
}

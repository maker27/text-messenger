'use client';

import { useEffect } from 'react';

import { MESSENGER_ORDER } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import { createUnreadFaviconHref } from '@/shared/favicon/unread-favicon';

const SVG_ICON_TYPE = 'image/svg+xml';

interface UnreadIndicatorsProps {
  unreadByMessenger: Record<MessengerId, number>;
}

export function UnreadIndicators({ unreadByMessenger }: UnreadIndicatorsProps) {
  const unreadTotal = MESSENGER_ORDER.reduce(
    (total, messengerId) => total + unreadByMessenger[messengerId],
    0,
  );

  useEffect(() => {
    if (unreadTotal === 0) {
      return;
    }

    const restoreTitle = replaceTitle(`(${String(unreadTotal)}) ${document.title}`);
    const restoreIcon = replaceIcon(createUnreadFaviconHref(unreadTotal));

    return () => {
      restoreTitle();
      restoreIcon();
    };
  }, [unreadTotal]);

  return null;
}

function replaceTitle(title: string) {
  const originalTitle = document.title;
  document.title = title;

  return () => {
    document.title = originalTitle;
  };
}

function replaceIcon(href: string) {
  const icon = document.head.querySelector('link[rel="icon"]');

  if (icon === null) {
    return () => undefined;
  }

  const originalHref = icon.getAttribute('href');
  const originalType = icon.getAttribute('type');
  icon.setAttribute('href', href);
  icon.setAttribute('type', SVG_ICON_TYPE);

  return () => {
    restoreAttribute(icon, 'href', originalHref);
    restoreAttribute(icon, 'type', originalType);
  };
}

function restoreAttribute(element: Element, name: string, value: string | null) {
  if (value === null) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, value);
  }
}

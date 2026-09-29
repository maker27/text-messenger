import type { MouseEvent } from 'react';

// Navigating to the current page refetches its server data and can hit the API rate limit.
export function handleCurrentPageLinkClick(event: MouseEvent<HTMLAnchorElement>) {
  if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.preventDefault();
  }
}

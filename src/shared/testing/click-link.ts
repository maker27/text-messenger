import { fireEvent } from '@testing-library/react';

export function clickLink(link: HTMLElement, init: MouseEventInit = {}) {
  let isPrevented = false;
  const handleWindowClick = (event: MouseEvent) => {
    isPrevented = event.defaultPrevented;
    event.preventDefault();
  };

  window.addEventListener('click', handleWindowClick);
  fireEvent.click(link, init);
  window.removeEventListener('click', handleWindowClick);

  return isPrevented;
}

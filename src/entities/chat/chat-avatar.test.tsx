import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { getAvatarColor } from './avatar-color';
import { ChatAvatar } from './chat-avatar';

test('is hidden from assistive technology', () => {
  render(<ChatAvatar chatId="79161234567@c.us" title="Иван" />);

  expect(screen.getByTitle('Иван')).toHaveAttribute('aria-hidden');
});

test('colors the avatar deterministically by chat id', () => {
  render(<ChatAvatar chatId="79161234567@c.us" title="Иван" />);

  expect(screen.getByTitle('Иван')).toHaveStyle({
    backgroundColor: getAvatarColor('79161234567@c.us'),
  });
});

import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { useHotkeys } from './use-hotkeys';

function renderHotkeys() {
  const onPaletteOpen = vi.fn();
  const onTabSelect = vi.fn();
  renderHook(() => {
    useHotkeys({ onPaletteOpen, onTabSelect });
  });
  return { onPaletteOpen, onTabSelect };
}

test('selects a tab by Ctrl and its number', async () => {
  const { onTabSelect } = renderHotkeys();

  await userEvent.keyboard('{Control>}2{/Control}');

  expect(onTabSelect).toHaveBeenCalledExactlyOnceWith('whatsapp');
});

test('prevents the browser default only for the handled shortcuts', () => {
  renderHotkeys();

  expect(fireEvent.keyDown(window, { code: 'Digit3', ctrlKey: true, key: '3' })).toBe(false);
  expect(fireEvent.keyDown(window, { code: 'Digit4', ctrlKey: true, key: '4' })).toBe(true);
  expect(fireEvent.keyDown(window, { code: 'Digit1', key: '1' })).toBe(true);
});

test('ignores Ctrl and a number without a tab', async () => {
  const { onTabSelect } = renderHotkeys();

  await userEvent.keyboard('{Control>}4{/Control}');

  expect(onTabSelect).not.toHaveBeenCalled();
});

test('ignores a tab number with extra modifiers', () => {
  const { onTabSelect } = renderHotkeys();

  fireEvent.keyDown(window, { altKey: true, code: 'Digit1', ctrlKey: true, key: '1' });
  fireEvent.keyDown(window, { code: 'Digit1', ctrlKey: true, key: '!', shiftKey: true });

  expect(onTabSelect).not.toHaveBeenCalled();
});

test.each([
  ['Meta+K', '{Meta>}k{/Meta}'],
  ['Ctrl+K', '{Control>}k{/Control}'],
])('opens the palette by %s', async (_shortcut, keys) => {
  const { onPaletteOpen } = renderHotkeys();

  await userEvent.keyboard(keys);

  expect(onPaletteOpen).toHaveBeenCalledOnce();
});

test('opens the palette in the Russian layout', () => {
  const { onPaletteOpen } = renderHotkeys();

  fireEvent.keyDown(window, { code: 'KeyK', ctrlKey: true, key: 'л' });

  expect(onPaletteOpen).toHaveBeenCalledOnce();
});

test('leaves regular typing in a text area alone', async () => {
  const { onPaletteOpen, onTabSelect } = renderHotkeys();
  render(<textarea aria-label="Сообщение" />);

  await userEvent.type(screen.getByRole('textbox', { name: 'Сообщение' }), 'k2');

  expect(screen.getByRole('textbox', { name: 'Сообщение' })).toHaveValue('k2');
  expect(onPaletteOpen).not.toHaveBeenCalled();
  expect(onTabSelect).not.toHaveBeenCalled();
});

test('handles the shortcuts inside a text area', async () => {
  const { onPaletteOpen } = renderHotkeys();
  render(<textarea aria-label="Сообщение" />);

  await userEvent.click(screen.getByRole('textbox', { name: 'Сообщение' }));
  await userEvent.keyboard('{Control>}k{/Control}');

  expect(onPaletteOpen).toHaveBeenCalledOnce();
});

test('handles a held shortcut once but still blocks its repeats', () => {
  const { onPaletteOpen, onTabSelect } = renderHotkeys();

  fireEvent.keyDown(window, { code: 'Digit2', ctrlKey: true, key: '2' });
  const isTabRepeatAllowed = fireEvent.keyDown(window, {
    code: 'Digit2',
    ctrlKey: true,
    key: '2',
    repeat: true,
  });
  fireEvent.keyDown(window, { code: 'KeyK', ctrlKey: true, key: 'k' });
  fireEvent.keyDown(window, { code: 'KeyK', ctrlKey: true, key: 'k', repeat: true });

  expect(isTabRepeatAllowed).toBe(false);
  expect(onTabSelect).toHaveBeenCalledOnce();
  expect(onPaletteOpen).toHaveBeenCalledOnce();
});

test('leaves shortcuts to an active IME composition', () => {
  const { onPaletteOpen, onTabSelect } = renderHotkeys();

  const isTabDefaultAllowed = fireEvent.keyDown(window, {
    code: 'Digit1',
    ctrlKey: true,
    isComposing: true,
    key: '1',
  });
  fireEvent.keyDown(window, { code: 'KeyK', isComposing: true, key: 'k', metaKey: true });

  expect(isTabDefaultAllowed).toBe(true);
  expect(onTabSelect).not.toHaveBeenCalled();
  expect(onPaletteOpen).not.toHaveBeenCalled();
});

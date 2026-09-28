import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

import type { MessengerId } from '@/entities/messenger/model';

import { Cube } from './cube';

const FACES = {
  max: <h2 tabIndex={-1}>MAX</h2>,
  telegram: <h2 tabIndex={-1}>Telegram</h2>,
  whatsapp: <h2 tabIndex={-1}>WhatsApp</h2>,
};

function stubReducedMotion(isReduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      addEventListener: vi.fn(),
      matches: isReduced && query === '(prefers-reduced-motion: reduce)',
      media: query,
      removeEventListener: vi.fn(),
    })),
  );
}

function stubCubeAnimations(transitionProperties: readonly string[]) {
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => transitionProperties.map((transitionProperty) => ({ transitionProperty })),
  });
}

function renderCube(activeMessenger: MessengerId) {
  const view = render(<Cube activeMessenger={activeMessenger} faces={FACES} />);

  return {
    ...view,
    finishRotation: () => {
      fireEvent.transitionEnd(getCube(), { propertyName: 'transform' });
    },
    rerenderCube: (nextMessenger: MessengerId) => {
      view.rerender(<Cube activeMessenger={nextMessenger} faces={FACES} />);
    },
  };
}

function getFace(messengerId: MessengerId) {
  const face = document.querySelector<HTMLElement>(`section[data-messenger="${messengerId}"]`);

  if (face === null) {
    throw new Error(`Face ${messengerId} is not rendered`);
  }

  return face;
}

function getCube() {
  const cube = getFace('max').parentElement;

  if (cube === null) {
    throw new Error('Cube is not rendered');
  }

  return cube;
}

function getVisibleFaces() {
  return (['max', 'telegram', 'whatsapp'] as const).filter((id) => !getFace(id).hidden);
}

beforeEach(() => {
  stubReducedMotion(false);
  stubCubeAnimations(['transform']);
});

test('keeps inactive faces inert and hidden', () => {
  renderCube('whatsapp');

  expect(getFace('whatsapp')).not.toHaveAttribute('inert');
  expect(getFace('max')).toHaveAttribute('inert');
  expect(getFace('telegram')).toHaveAttribute('inert');
  expect(getVisibleFaces()).toEqual(['whatsapp']);
});

test('shows both faces while rotating and only the active one after', () => {
  const { finishRotation, rerenderCube } = renderCube('max');

  rerenderCube('whatsapp');

  expect(getVisibleFaces()).toEqual(['max', 'whatsapp']);
  expect(getFace('max')).toHaveAttribute('inert');

  finishRotation();

  expect(getVisibleFaces()).toEqual(['whatsapp']);
});

test('shows the faces passed on the way while rotating', () => {
  const { finishRotation, rerenderCube } = renderCube('max');

  rerenderCube('telegram');

  expect(getVisibleFaces()).toEqual(['max', 'telegram', 'whatsapp']);
  expect(getFace('whatsapp')).toHaveAttribute('inert');

  finishRotation();

  expect(getVisibleFaces()).toEqual(['telegram']);
});

test('marks the cube as rotating until the rotation ends', () => {
  const { finishRotation, rerenderCube } = renderCube('max');

  expect(getCube()).toHaveAttribute('data-rotating', 'false');

  rerenderCube('telegram');

  expect(getCube()).toHaveAttribute('data-rotating', 'true');

  finishRotation();

  expect(getCube()).toHaveAttribute('data-rotating', 'false');
});

test('keeps rotating when only the zoom transition ends', () => {
  const { rerenderCube } = renderCube('max');

  rerenderCube('whatsapp');
  fireEvent.transitionEnd(getCube(), { propertyName: 'scale' });

  expect(getVisibleFaces()).toEqual(['max', 'whatsapp']);
});

test('settles at once when the browser starts no rotation', () => {
  const { rerenderCube } = renderCube('max');
  stubCubeAnimations(['scale']);

  rerenderCube('telegram');

  expect(getVisibleFaces()).toEqual(['telegram']);
  expect(getCube()).toHaveAttribute('data-rotating', 'false');
});

test('ignores transitions of nested elements', () => {
  const { rerenderCube } = renderCube('max');

  rerenderCube('whatsapp');
  fireEvent.transitionEnd(screen.getByRole('heading', { name: 'WhatsApp' }), {
    propertyName: 'transform',
  });

  expect(getVisibleFaces()).toEqual(['max', 'whatsapp']);
});

test('leaves only the last face after fast switches', () => {
  const { finishRotation, rerenderCube } = renderCube('max');

  rerenderCube('whatsapp');
  rerenderCube('telegram');
  rerenderCube('whatsapp');
  finishRotation();

  expect(getVisibleFaces()).toEqual(['whatsapp']);
  expect(getFace('max')).toHaveAttribute('inert');
  expect(getFace('telegram')).toHaveAttribute('inert');
});

test('switches faces at once with reduced motion', () => {
  stubReducedMotion(true);
  const { rerenderCube } = renderCube('max');

  rerenderCube('telegram');

  expect(getVisibleFaces()).toEqual(['telegram']);
  expect(screen.getByRole('heading', { name: 'Telegram' })).toHaveFocus();
});

test('focuses the active heading after rotation', () => {
  const { finishRotation, rerenderCube } = renderCube('max');

  rerenderCube('whatsapp');

  expect(screen.getByRole('heading', { name: 'WhatsApp' })).not.toHaveFocus();

  finishRotation();

  expect(screen.getByRole('heading', { name: 'WhatsApp' })).toHaveFocus();
});

test('does not steal focus on first render', () => {
  renderCube('max');

  expect(screen.getByRole('heading', { name: 'MAX' })).not.toHaveFocus();
});

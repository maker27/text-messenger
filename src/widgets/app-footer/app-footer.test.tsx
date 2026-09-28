import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { AppFooter } from './app-footer';

const TRANSPORT_NOTICE =
  'Приложение не соединяется с серверами мессенджеров напрямую — все запросы идут через API GREEN-API';
const WHATSAPP_FOOTNOTE =
  '* WhatsApp принадлежит компании Meta Platforms Inc., деятельность которой признана экстремистской и запрещена на территории РФ';

test('explains that requests go through GREEN-API', () => {
  render(<AppFooter isDemo={false} />);

  expect(screen.getByRole('contentinfo')).toHaveTextContent(TRANSPORT_NOTICE);
  expect(screen.queryByText(/Демонстрационная версия/)).not.toBeInTheDocument();
});

test('marks the demo version before the transport notice', () => {
  render(<AppFooter isDemo />);

  expect(screen.getByText(/Демонстрационная версия/).closest('p')).toHaveTextContent(
    `Демонстрационная версия. ${TRANSPORT_NOTICE}`,
  );
});

test.each([true, false])('shows the WhatsApp footnote when isDemo is %s', (isDemo) => {
  render(<AppFooter isDemo={isDemo} />);

  expect(screen.getByText(WHATSAPP_FOOTNOTE)).toBeInTheDocument();
});

test('links to the privacy page', () => {
  render(<AppFooter isDemo={false} />);

  expect(screen.getByRole('link', { name: 'Конфиденциальность' })).toHaveAttribute(
    'href',
    '/privacy',
  );
});

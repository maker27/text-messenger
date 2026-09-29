import AxeBuilder from '@axe-core/playwright';
import {
  test as base,
  expect,
  type ConsoleMessage,
  type Page,
  type Response,
} from '@playwright/test';

const FAILING_CONSOLE_TYPES = ['error', 'warning'];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
// Chromium logs this itself for requests made while a test holds the context offline, e.g. the
// EventSource reconnect; the app cannot prevent it.
const OFFLINE_REQUEST_ERROR = 'net::ERR_INTERNET_DISCONNECTED';

function describeConsoleMessage(message: ConsoleMessage) {
  return `console.${message.type()}: ${message.text()}`;
}

// GREEN-API URLs carry apiTokenInstance in the path, so foreign URLs are reduced to their origin.
function describeFailedResponse(response: Response, page: Page) {
  const url = new URL(response.url());
  const location = url.origin === new URL(page.url()).origin ? url.pathname : url.origin;
  return `${String(response.status())} ${location}`;
}

export const test = base.extend<{
  makeAxeBuilder: (page: Page) => AxeBuilder;
}>({
  page: async ({ page }, use) => {
    const consoleFailures: string[] = [];
    const responseFailures: string[] = [];

    page.on('console', (message) => {
      if (
        FAILING_CONSOLE_TYPES.includes(message.type()) &&
        !message.text().includes(OFFLINE_REQUEST_ERROR)
      ) {
        consoleFailures.push(describeConsoleMessage(message));
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        responseFailures.push(describeFailedResponse(response, page));
      }
    });

    await use(page);

    expect(consoleFailures, 'unexpected console error/warning').toEqual([]);
    expect(responseFailures, 'unexpected response with status >= 400').toEqual([]);
  },
  makeAxeBuilder: async ({}, use) => {
    // react-aria-components' Button announces isPending transitions through a global
    // live-announcer node (role="img" + aria-labelledby) that self-removes after 7s
    // (see react-aria/private/live-announcer/LiveAnnouncer). Scanning right after a
    // pending action can catch it mid-flight; it is invisible and not a real a11y defect.
    await use((page) =>
      new AxeBuilder({ page }).withTags(AXE_TAGS).exclude('[data-live-announcer]'),
    );
  },
});

export { expect };

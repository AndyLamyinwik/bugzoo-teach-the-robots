import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** New browser contexts isolate every test; this observer also follows reopened tabs. */
export const test = base.extend<{ browserHealth: void }>({
  browserHealth: [
    async ({ context, baseURL }, use, testInfo) => {
      if (!baseURL) throw new Error('A real application base URL is required.');
      const allowedOrigin = new URL(baseURL).origin;
      const failures: string[] = [];
      function observe(page: Page) {
        page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
        page.on('console', (message) => {
          if (message.type() === 'error' || message.type() === 'warning')
            failures.push(`${message.type()}: ${message.text()}`);
        });
        page.on('request', (request) => {
          const url = new URL(request.url());
          if (['http:', 'https:'].includes(url.protocol) && url.origin !== allowedOrigin)
            failures.push(`unexpected external request: ${url.origin}${url.pathname}`);
        });
        page.on('response', (response) => {
          if (response.status() >= 400)
            failures.push(`HTTP ${response.status()}: ${response.url()}`);
        });
      }
      for (const page of context.pages()) observe(page);
      context.on('page', observe);
      await context.addInitScript((origin) => {
        if (
          location.origin === origin &&
          localStorage.getItem('bugzoo.locale.v1') === null
        )
          localStorage.setItem('bugzoo.locale.v1', 'en');
      }, allowedOrigin);
      await use();
      context.off('page', observe);
      if (failures.length)
        await testInfo.attach('browser-health', {
          body: failures.join('\n'),
          contentType: 'text/plain',
        });
      expect(
        failures,
        'All tabs must remain free of browser errors, warnings, HTTP failures, and external data requests.',
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

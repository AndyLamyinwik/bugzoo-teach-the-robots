import { defineConfig } from '@playwright/test';
import { resolveBasePath } from './src/deployment/basePath';

const channel = process.env.BUGZOO_E2E_CHANNEL;
if (channel !== undefined && channel !== 'chrome' && channel !== 'msedge') {
  throw new Error(
    'BUGZOO_E2E_CHANNEL must be chrome or msedge, or left unset for bundled Chromium.',
  );
}

const baseURL = new URL(process.env.BUGZOO_E2E_BASE_URL ?? 'http://127.0.0.1:4173/');
if (
  !['http:', 'https:'].includes(baseURL.protocol) ||
  baseURL.username ||
  baseURL.password ||
  baseURL.search ||
  baseURL.hash
)
  throw new Error(
    'BUGZOO_E2E_BASE_URL must be an HTTP(S) URL without credentials, query, or fragment.',
  );
const basePath = resolveBasePath(baseURL.pathname);
const external = process.env.BUGZOO_E2E_EXTERNAL === '1';
const production = process.env.BUGZOO_E2E_PRODUCTION === '1';
if (!external && (baseURL.hostname !== '127.0.0.1' || baseURL.protocol !== 'http:'))
  throw new Error(
    'Local E2E servers require http://127.0.0.1; set BUGZOO_E2E_EXTERNAL=1 to test a deployed site.',
  );
const port = baseURL.port || '80';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: baseURL.href,
    browserName: 'chromium',
    ...(channel ? { channel } : {}),
    locale: 'en-US',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { viewport: { width: 1280, height: 900 } } },
    {
      name: 'chromium-320',
      use: { viewport: { width: 320, height: 900 }, isMobile: true, hasTouch: true },
    },
  ],
  ...(!external
    ? {
        webServer: {
          command: `node node_modules/vite/bin/vite.js ${production ? 'preview ' : ''}--host 127.0.0.1 --port ${port} --strictPort`,
          url: baseURL.href,
          env: { BUGZOO_BASE_PATH: basePath },
          reuseExistingServer: false,
          timeout: 30_000,
        },
      }
    : {}),
});

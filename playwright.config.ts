import { defineConfig, devices } from '@playwright/test';

// Tests run on their own port against the sample drops in tests/fixtures/drops (D25), so
// real posts never change what they see. CI tests the built site, which it builds with
// DROPS_DIR set (see ci.yml); locally it builds the site with it first (Astro allows only
// one dev server per project, and yours may be running).
const PORT = 4322;
const DROPS_DIR = 'tests/fixtures/drops';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: process.env.CI
      ? `npm run preview -- --port ${PORT}`
      : `npm run build && npm run preview -- --port ${PORT}`,
    timeout: 240_000,
    url: `http://localhost:${PORT}`,
    env: { DROPS_DIR },
    reuseExistingServer: !process.env.CI,
  },
});

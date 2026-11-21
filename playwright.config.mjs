import { defineConfig } from '@playwright/test';

// Real-browser tests (e2e/): a robot Chrome clicks through the site like a person.
// Run: npm run test:e2e  (builds the site, starts it on port 3200, runs the tests, stops it)
// Against the live site: E2E_BASE_URL=https://maison-ade.vercel.app npx playwright test
process.loadEnvFile?.('.env.local');

const live = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  workers: 1, // one at a time: the tests book real (test) appointments
  timeout: 60_000,
  reporter: 'list',
  use: { baseURL: live || 'http://localhost:3200', trace: 'retain-on-failure' },
  webServer: live ? undefined : {
    command: 'npx next start -p 3200',
    url: 'http://localhost:3200',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

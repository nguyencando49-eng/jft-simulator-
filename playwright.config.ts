import { defineConfig, devices } from '@playwright/test';

const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...(executablePath?{launchOptions:{executablePath}}:{}) } }],
  webServer: {
    command: 'npm run dev -- -p 3100',
    url: 'http://127.0.0.1:3100/api/v1/system',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      AUTH_DISABLED: 'true',
      AI_FACTORY_PROVIDER: 'mock',
      AI_QA_PROVIDER: 'mock',
      TTS_PROVIDER: 'mock',
      E2E_TEST_MODE: 'true',
    },
  },
});

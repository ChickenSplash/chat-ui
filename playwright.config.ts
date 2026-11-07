import { defineConfig, devices } from '@playwright/test'

// Runs against a deployed chat-ui (nginx + HMS), e.g. through an SSH tunnel to the homelab:
// BASE_URL=http://localhost:8090 npx playwright test
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /mobile\.spec/ },
    // WebKit needs Ubuntu's libraries, so on Arch run this one in Playwright's own image (see README).
    { name: 'mobile', use: { ...devices['iPhone 13'] }, testMatch: /mobile\.spec/ },
  ],
})

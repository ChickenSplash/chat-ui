import { expect, test, type Page } from '@playwright/test'

// HMS rate limits sign-ins per CF-Connecting-IP. Off Cloudflare nothing overwrites the
// header, so each test claims its own address instead of sharing one budget.
test.beforeEach(async ({ context }) => {
  const octet = () => Math.floor(Math.random() * 254) + 1
  await context.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.${octet()}.${octet()}.${octet()}` })
})

const unique = () => Math.random().toString(36).slice(2, 10)

async function logOut(page: Page) {
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('tab', { name: 'Join as guest' })).toBeVisible()
}

test('a guest joins, pings over the WebSocket, renames and leaves', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Display name').fill('Smoke Guest')
  await page.getByRole('button', { name: 'Join' }).click()

  await expect(page.getByText('Connected as')).toBeVisible()
  await expect(page.getByTestId('public-id')).toHaveText(/^#[a-z2-9]{8}$/)
  await expect(page.getByTestId('connection-state')).toHaveText('connected')

  await page.getByRole('button', { name: 'Ping' }).click()
  await expect(page.getByTestId('ping-result')).toHaveText(/Pong in \d+ ms/)

  await page.getByRole('link', { name: 'Profile' }).click()
  await page.getByLabel('Display name').fill('Renamed Guest')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved')).toBeVisible()
  await expect(page.locator('header')).toContainText('Renamed Guest')
  await expect(page.getByRole('heading', { name: 'Password' })).toHaveCount(0)

  // A reload keeps the session.
  await page.reload()
  await expect(page.locator('header')).toContainText('Renamed Guest')

  await logOut(page)
})

test('someone registers, logs out and logs back in', async ({ page }) => {
  const email = `e2e-${unique()}@example.com`

  await page.goto('/')
  await page.getByRole('tab', { name: 'Register' }).click()
  await page.getByLabel('Display name').fill('E2E User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('a-long-password')
  await page.getByLabel('Confirm password').fill('a-long-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Connected as')).toBeVisible()
  await expect(page.locator('header')).not.toContainText('guest')

  await logOut(page)

  await page.getByRole('tab', { name: 'Log in' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('These credentials do not match our records.')).toBeVisible()

  await page.getByLabel('Password').fill('a-long-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Connected as')).toBeVisible()

  await page.getByRole('link', { name: 'Profile' }).click()
  await expect(page.getByText(email)).toBeVisible()

  await page.getByLabel('Current password').fill('a-long-password')
  await page.getByLabel('New password', { exact: true }).fill('another-long-password')
  await page.getByLabel('Confirm new password').fill('another-long-password')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByText('Password changed')).toBeVisible()

  await logOut(page)
  await page.getByRole('tab', { name: 'Log in' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('another-long-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  // Signing back in keeps the page you were on (the profile).
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
})

test('a blank-looking name is refused under the field', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Display name').fill('   ')
  await page.getByRole('button', { name: 'Join' }).click()
  await expect(page.getByText(/display name field/i)).toBeVisible()
})

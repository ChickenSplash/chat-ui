import { expect, test } from '@playwright/test'
import { logOut, ownIp, unique } from './helpers'

test.beforeEach(({ context }) => ownIp(context))

test('a guest joins, pings over the WebSocket, renames and leaves', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Display name').fill('Smoke Guest')
  await page.getByRole('checkbox', { name: /agree to the terms/ }).check()
  await page.getByRole('button', { name: 'Join' }).click()

  await expect(page.getByTestId('me')).toContainText('Smoke Guest')
  await expect(page.getByRole('heading', { name: 'Friends', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'User settings' }).click()
  await expect(page.getByTestId('public-id')).toHaveText(/^#[a-z2-9]{8}$/)

  await page.getByRole('button', { name: 'Developer' }).click()
  await expect(page.getByTestId('connection-state')).toHaveText('connected')
  await page.getByRole('button', { name: 'Ping' }).click()
  await expect(page.getByTestId('ping-result')).toHaveText(/Pong in \d+ ms/)

  await page.getByRole('button', { name: 'Profile' }).click()
  await page.getByLabel('Display name').fill('Renamed Guest')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved')).toBeVisible()
  await expect(page.getByTestId('me')).toContainText('Renamed Guest')
  await expect(page.getByRole('heading', { name: 'Password' })).toHaveCount(0)

  // A reload keeps the session.
  await page.reload()
  await expect(page.getByTestId('me')).toContainText('Renamed Guest')

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
  await page.getByRole('checkbox', { name: /agree to the terms/ }).check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByTestId('me')).toHaveText('E2E User')

  await logOut(page)

  await page.getByRole('tab', { name: 'Log in' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('These credentials do not match our records.')).toBeVisible()

  await page.getByLabel('Password').fill('a-long-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByTestId('me')).toHaveText('E2E User')

  await page.getByRole('button', { name: 'User settings' }).click()
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
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
})

test('a blank-looking name is refused under the field', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Display name').fill('   ')
  await page.getByRole('checkbox', { name: /agree to the terms/ }).check()
  await page.getByRole('button', { name: 'Join' }).click()
  await expect(page.getByText(/display name field/i)).toBeVisible()
})

test('joining needs the terms agreed, and the terms open without signing in', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Display name').fill('Hasty Guest')
  await page.getByRole('button', { name: 'Join' }).click()
  await expect(page.getByRole('tab', { name: 'Join as guest' })).toBeVisible()
  await expect(page.getByTestId('me')).toHaveCount(0)

  const [terms] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('link', { name: 'terms and privacy policy' }).click(),
  ])
  await expect(terms.getByRole('heading', { name: 'Terms and privacy' })).toBeVisible()
  await expect(terms.getByRole('link', { name: 'guardeded@gmail.com' }).first()).toBeVisible()
  await expect(page.getByLabel('Display name')).toHaveValue('Hasty Guest')
})

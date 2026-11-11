import { expect, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from '@playwright/test'

/**
 * HMS rate limits sign-ins per CF-Connecting-IP. Off Cloudflare nothing overwrites the
 * header, so each browser context claims its own address instead of sharing one budget.
 */
export async function ownIp(context: BrowserContext) {
  const octet = () => Math.floor(Math.random() * 254) + 1
  await context.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.${octet()}.${octet()}.${octet()}` })
}

export const unique = () => Math.random().toString(36).slice(2, 10)

/**
 * Opens the app signed out, which sends you to the shared sign-in site (HMS, on :8091 in the
 * dev stack), and picks a tab there.
 */
export async function openSignIn(page: Page, tab: 'Log in' | 'Register' | 'Join as guest', path = '/') {
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'Homelab accounts' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Sign in' }).getByRole('link', { name: tab }).click()
}

/** Back on the sign-in site, signed out. */
export async function expectSignedOut(page: Page) {
  await expect(page.getByRole('heading', { name: 'Homelab accounts' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Log in' })).toHaveAttribute('aria-current', 'page')
}

/** Joins as a guest and returns their public ID. */
export async function joinAsGuest(page: Page, name: string): Promise<string> {
  await openSignIn(page, 'Join as guest')
  await page.getByLabel('Display name').fill(name)
  await page.getByRole('checkbox', { name: /agree to the terms/ }).check()
  await page.getByRole('button', { name: 'Join' }).click()
  await expect(page.getByTestId('me')).toContainText(name)

  await page.getByRole('button', { name: 'User settings' }).click()
  const id = (await page.getByTestId('public-id').textContent())!.replace('#', '')
  await page.getByRole('button', { name: 'Close' }).click()
  // On a phone the sidebar is hidden while a page shows.
  const nav = page.getByRole('button', { name: 'Open navigation' })
  if (await nav.isVisible()) await nav.click()
  await page.getByRole('link', { name: /^Friends/ }).click()
  return id
}

/** Accepts the confirmation modal on top (the app's own, not the browser's). */
export async function confirmModal(page: Page) {
  await page.getByRole('dialog').last().locator('button[type="submit"]').click()
}

export async function logOut(page: Page) {
  // From the settings modal if it's open, otherwise the panel under the sidebar.
  const settings = page.getByRole('dialog', { name: 'User settings' })
  await ((await settings.isVisible()) ? settings : page).getByRole('button', { name: 'Log out' }).click()
  await confirmModal(page)
  await expectSignedOut(page)
}

/** Two people, each in their own browser context (separate cookies, separate WebSocket). */
export async function twoGuests(browser: Browser, options: BrowserContextOptions = {}) {
  const open = async (name: string) => {
    const context = await browser.newContext(options)
    await ownIp(context)
    const page = await context.newPage()
    return { page, id: await joinAsGuest(page, name) }
  }
  return Promise.all([open('Alice'), open('Bob')])
}

export async function befriend(alice: { page: Page }, bob: { page: Page; id: string }) {
  await alice.page.getByRole('tab', { name: 'Add Friend' }).click()
  await alice.page.getByLabel('Their ID').fill(bob.id)
  await alice.page.getByRole('button', { name: 'Send Friend Request' }).click()
  await expect(alice.page.getByText('Friend request sent to Bob.')).toBeVisible()

  // Bob never refreshes: the request, its badge and the acceptance all arrive live.
  await expect(bob.page.getByRole('tab', { name: 'Pending' })).toContainText('1')
  await bob.page.getByRole('tab', { name: 'Pending' }).click()
  await bob.page.getByRole('button', { name: 'Accept Alice' }).click()

  await alice.page.getByRole('tab', { name: 'All' }).click()
  await expect(alice.page.getByRole('button', { name: 'Message Bob' })).toBeVisible()
}

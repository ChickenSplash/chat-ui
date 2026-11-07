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

/** Joins as a guest and returns their public ID. */
export async function joinAsGuest(page: Page, name: string): Promise<string> {
  await page.goto('/')
  await page.getByLabel('Display name').fill(name)
  await page.getByRole('button', { name: 'Join' }).click()
  await expect(page.getByTestId('me')).toContainText(name)

  await page.getByRole('link', { name: 'Settings' }).click()
  const id = (await page.getByTestId('public-id').textContent())!.replace('#', '')
  // On a phone the sidebar is hidden while a page shows.
  const nav = page.getByRole('button', { name: 'Open navigation' })
  if (await nav.isVisible()) await nav.click()
  await page.getByRole('link', { name: /^Friends/ }).click()
  return id
}

export async function logOut(page: Page) {
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('tab', { name: 'Join as guest' })).toBeVisible()
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

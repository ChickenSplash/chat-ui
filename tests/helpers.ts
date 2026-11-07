import { expect, type BrowserContext, type Page } from '@playwright/test'

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
  await page.getByRole('link', { name: /^Friends/ }).click()
  return id
}

export async function logOut(page: Page) {
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('tab', { name: 'Join as guest' })).toBeVisible()
}

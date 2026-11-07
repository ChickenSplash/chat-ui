import { devices, expect, test, type Page } from '@playwright/test'
import { befriend, twoGuests } from './helpers'

// Runs in the "mobile" project only (WebKit, so Safari's engine, at iPhone size). Contexts
// made with browser.newContext() don't pick up the project's device, so it's passed here.
const phone = devices['iPhone 13']

const navigation = (page: Page) => page.getByTestId('navigation')

async function openNavigation(page: Page) {
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(navigation(page)).toBeVisible()
}

async function fitsTheScreen(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test('on a phone, one panel shows at a time', async ({ browser }) => {
  const [alice, bob] = await twoGuests(browser, phone)
  await befriend(alice, bob)

  // A page fills the screen; the navigation is one tap away.
  await expect(navigation(alice.page)).toBeHidden()
  await fitsTheScreen(alice.page)
  await alice.page.getByRole('button', { name: 'Message Bob' }).click()
  const box = alice.page.getByLabel('Message @Bob')
  await box.fill('Hello from a phone')
  await box.press('Enter')
  await expect(alice.page.getByTestId('message').filter({ hasText: 'Hello from a phone' })).toBeVisible()
  await fitsTheScreen(alice.page)

  // Bob goes back to the list, sees the DM with its badge and Alice online, and opens it.
  await openNavigation(bob.page)
  const dm = bob.page.getByRole('list', { name: 'Direct messages' }).getByRole('link', { name: /Alice/ })
  await expect(dm).toContainText('1')
  await expect(dm.locator('[data-status="online"]')).toBeVisible()
  await fitsTheScreen(bob.page)
  await dm.tap()
  await expect(navigation(bob.page)).toBeHidden()
  await expect(bob.page.getByTestId('message').filter({ hasText: 'Hello from a phone' })).toBeVisible()
})

test('on a phone, groups open from the rail and the member list slides over the chat', async ({ browser }) => {
  const [alice] = await twoGuests(browser, phone)
  const name = `Phone ${Math.random().toString(36).slice(2, 8)}`

  await openNavigation(alice.page)
  await alice.page.getByRole('link', { name: 'Create or join a group' }).tap()
  await expect(navigation(alice.page)).toBeHidden()
  await alice.page.getByLabel('Group name').fill(name)
  await alice.page.getByRole('button', { name: 'Create group' }).tap()
  await expect(alice.page.getByRole('heading', { name: `Welcome to ${name}` })).toBeVisible()

  // Starts closed on a phone, opens over the chat and closes from the backdrop.
  const members = alice.page.getByRole('complementary', { name: 'Members' })
  await expect(members).toHaveCount(0)
  await alice.page.getByRole('button', { name: 'Show member list' }).tap()
  await expect(members).toBeInViewport()
  await expect(members.locator('[data-status="online"]')).toBeVisible()
  await alice.page.getByRole('button', { name: 'Close member list' }).click({ position: { x: 20, y: 300 } })
  await expect(members).toHaveCount(0)

  // The rail switches the sidebar to the group's channels; picking one shows it.
  await openNavigation(alice.page)
  await alice.page.getByRole('list', { name: 'Groups' }).getByRole('link', { name }).tap()
  await expect(navigation(alice.page)).toBeVisible()
  await alice.page.getByRole('link', { name: 'chat' }).tap()
  await expect(alice.page.getByLabel(`Message ${name}`)).toBeVisible()
  await fitsTheScreen(alice.page)
})

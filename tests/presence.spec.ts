import { expect, test, type Page } from '@playwright/test'
import { befriend, twoGuests } from './helpers'

async function setStatus(page: Page, status: string) {
  await page.getByRole('button', { name: 'Set status' }).click()
  await page.getByRole('menuitemradio', { name: new RegExp(`^${status}`) }).click()
  await expect(page.getByRole('menu', { name: 'Status' })).toHaveCount(0)
}

async function openDm(page: Page, name: string) {
  await page.getByRole('list', { name: 'Direct messages' }).getByRole('link', { name: new RegExp(name) }).click()
  await expect(page.getByLabel(`Message @${name}`)).toBeVisible()
}

test('friends see each other come online, change status and go offline', async ({ browser }) => {
  const [alice, bob] = await twoGuests(browser)
  await befriend(alice, bob)
  const bobRow = alice.page.getByTestId(`friend-${bob.id}`)

  await expect(bobRow).toContainText('Online')
  await expect(bobRow.locator('[data-status="online"]')).toBeVisible()

  await setStatus(bob.page, 'Do Not Disturb')
  await expect(bobRow).toContainText('Do Not Disturb')
  await expect(bobRow.locator('[data-status="dnd"]')).toBeVisible()

  await setStatus(bob.page, 'Invisible')
  await expect(bobRow).toContainText('Offline')
  // Bob still sees himself as invisible, and the menu remembers it.
  await bob.page.getByRole('button', { name: 'Set status' }).click()
  await expect(bob.page.getByRole('menuitemradio', { name: /^Invisible/ })).toHaveAttribute('aria-checked', 'true')
  await bob.page.getByRole('menuitemradio', { name: /^Online/ }).click()
  await expect(bobRow).toContainText('Online')

  // Closing the last tab shows Bob offline after the few seconds' grace.
  await bob.page.context().close()
  await expect(bobRow).toContainText('Offline', { timeout: 15_000 })
})

test('a reload does not show you offline', async ({ browser }) => {
  const [alice, bob] = await twoGuests(browser)
  await befriend(alice, bob)
  const bobRow = alice.page.getByTestId(`friend-${bob.id}`)
  await expect(bobRow).toContainText('Online')

  const seen: string[] = []
  await alice.page.exposeFunction('reportStatus', (text: string) => seen.push(text))
  await alice.page.evaluate((id) => {
    const row = document.querySelector(`[data-testid="friend-${id}"]`)!
    new MutationObserver(() => (window as unknown as { reportStatus: (t: string) => void }).reportStatus(row.textContent ?? '')).observe(row, {
      subtree: true,
      childList: true,
      characterData: true,
    })
  }, bob.id)

  await bob.page.reload()
  await expect(bob.page.getByTestId('me')).toBeVisible()
  await alice.page.waitForTimeout(8000)

  expect(seen.some((text) => text.includes('Offline'))).toBe(false)
  await expect(bobRow).toContainText('Online')
})

test('typing shows while someone types and clears when they send', async ({ browser }) => {
  const [alice, bob] = await twoGuests(browser)
  await befriend(alice, bob)
  await alice.page.getByRole('button', { name: 'Message Bob' }).click()
  await alice.page.getByLabel('Message @Bob').fill('hi')
  await alice.page.getByLabel('Message @Bob').press('Enter')
  await openDm(bob.page, 'Alice')

  await bob.page.getByLabel('Message @Alice').fill('Hello the')
  await expect(alice.page.getByTestId('typing')).toHaveText('Bob is typing…')
  await bob.page.getByLabel('Message @Alice').press('Enter')
  await expect(alice.page.getByTestId('message').filter({ hasText: 'Hello the' })).toBeVisible()
  await expect(alice.page.getByTestId('typing')).toHaveText('')

  // Without the message, it fades out by itself.
  await bob.page.getByLabel('Message @Alice').fill('one more')
  await expect(alice.page.getByTestId('typing')).toHaveText('Bob is typing…')
  await expect(alice.page.getByTestId('typing')).toHaveText('', { timeout: 8000 })
})

test('a red line marks where you stopped reading, with a banner to jump to it', async ({ browser }) => {
  // Short enough that the unread messages don't fit on screen.
  const [alice, bob] = await twoGuests(browser, { viewport: { width: 1280, height: 500 } })
  await befriend(alice, bob)
  await alice.page.getByRole('button', { name: 'Message Bob' }).click()
  const box = alice.page.getByLabel('Message @Bob')
  await box.fill('already read')
  await box.press('Enter')
  await openDm(bob.page, 'Alice')
  await expect(bob.page.getByTestId('message').filter({ hasText: 'already read' })).toBeVisible()
  await bob.page.getByRole('link', { name: /^Friends/ }).click()

  const unread = ['first unread', ...Array.from({ length: 6 }, (_, i) => `tall ${i}\n.\n.\n.\n.`)]
  for (const text of unread) {
    await box.fill(text)
    await box.press('Enter')
    await expect(alice.page.getByTestId('message').filter({ hasText: text.split('\n')[0] })).toBeVisible()
  }

  await openDm(bob.page, 'Alice')
  const banner = bob.page.getByTestId('unread-banner')
  await expect(banner).toContainText('7 new messages since')
  await banner.getByRole('button', { name: 'Jump' }).click()

  const divider = bob.page.getByTestId('unread-divider')
  await expect(divider).toBeInViewport()
  await expect(divider.locator('xpath=following-sibling::*[1]')).toContainText('first unread')
  await expect(banner).toHaveCount(0)

  // It stays until dismissed, even though the messages are now read.
  await expect(bob.page.getByRole('list', { name: 'Direct messages' }).getByRole('link', { name: /Alice/ })).not.toContainText('7')
  await bob.page.keyboard.press('Escape')
  await expect(divider).toHaveCount(0)
})

test('no red line when there is nothing new', async ({ browser }) => {
  const [alice, bob] = await twoGuests(browser)
  await befriend(alice, bob)
  await alice.page.getByRole('button', { name: 'Message Bob' }).click()
  await alice.page.getByLabel('Message @Bob').fill('hi')
  await alice.page.getByLabel('Message @Bob').press('Enter')

  await openDm(bob.page, 'Alice')
  await expect(bob.page.getByTestId('unread-divider')).toBeVisible()
  await bob.page.getByRole('link', { name: /^Friends/ }).click()
  await openDm(bob.page, 'Alice')
  await expect(bob.page.getByTestId('message').filter({ hasText: 'hi' })).toBeVisible()
  await expect(bob.page.getByTestId('unread-divider')).toHaveCount(0)

  // Messages arriving while you watch don't get one either.
  await alice.page.getByLabel('Message @Bob').fill('live one')
  await alice.page.getByLabel('Message @Bob').press('Enter')
  await expect(bob.page.getByTestId('message').filter({ hasText: 'live one' })).toBeVisible()
  await expect(bob.page.getByTestId('unread-divider')).toHaveCount(0)
})

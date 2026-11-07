import { expect, test } from '@playwright/test'
import { befriend, twoGuests } from './helpers'

test('two people become friends and chat live', async ({ browser }) => {
  const [alice, bob] = await twoGuests(browser)
  await befriend(alice, bob)

  await alice.page.getByRole('button', { name: 'Message Bob' }).click()
  const aliceBox = alice.page.getByLabel('Message @Bob')
  await aliceBox.fill('Hello Bob! https://example.com')
  await aliceBox.press('Enter')
  await expect(alice.page.getByTestId('message').last()).toContainText('Hello Bob!')
  await expect(alice.page.getByRole('link', { name: 'https://example.com' })).toBeVisible()

  // Bob sees an unread badge on the new DM, then reads it.
  const bobDm = bob.page.getByRole('list', { name: 'Direct messages' }).getByRole('link', { name: /Alice/ })
  await expect(bobDm).toContainText('1')
  await bobDm.click()
  await expect(bob.page.getByTestId('message').last()).toContainText('Hello Bob!')
  await expect(bobDm).not.toContainText('1')

  const bobBox = bob.page.getByLabel('Message @Alice')
  await bobBox.fill('Hi Alice')
  await bobBox.press('Enter')
  await expect(alice.page.getByTestId('message').last()).toContainText('Hi Alice')

  // Deleting a message removes it on both sides.
  const mine = alice.page.getByTestId('message').filter({ hasText: 'Hello Bob!' })
  await mine.hover()
  alice.page.once('dialog', (dialog) => dialog.accept())
  await mine.getByRole('button', { name: 'Delete message' }).click()
  await expect(bob.page.getByText('Hello Bob!')).toHaveCount(0)
})

test('a message shows grey until saved, and red with retry when sending fails', async ({ browser }) => {
  const [alice, bob] = await twoGuests(browser)

  await alice.page.getByLabel('Message someone by ID').fill(bob.id)
  await alice.page.getByLabel('Message someone by ID').press('Enter')
  const box = alice.page.getByLabel('Message @Bob')

  // Hold the first send back, then fail it.
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  await alice.page.route('**/api/conversations/*/messages', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await held
    await route.abort()
  })

  await box.fill('Are you there?')
  await box.press('Enter')
  await expect(alice.page.getByTestId('message-pending')).toContainText('Are you there?')

  release()
  await expect(alice.page.getByTestId('message-failed')).toContainText('Failed to send.')

  await alice.page.unroute('**/api/conversations/*/messages')
  await alice.page.getByRole('button', { name: 'Retry' }).click()
  await expect(alice.page.getByTestId('message')).toContainText('Are you there?')
  await expect(alice.page.getByTestId('message-failed')).toHaveCount(0)
  await expect(bob.page.getByRole('list', { name: 'Direct messages' })).toContainText('Alice')
})

test('blocking stops messages both ways without telling the blocked person why', async ({ browser }) => {
  const [alice, bob] = await twoGuests(browser)
  await befriend(alice, bob)

  await alice.page.getByRole('button', { name: 'Message Bob' }).click()
  await alice.page.getByLabel('Message @Bob').fill('before the block')
  await alice.page.getByLabel('Message @Bob').press('Enter')
  await expect(bob.page.getByRole('list', { name: 'Direct messages' })).toContainText('Alice')

  await bob.page.getByRole('tab', { name: 'All' }).click()
  bob.page.once('dialog', (dialog) => dialog.accept())
  await bob.page.getByRole('button', { name: 'Block Alice' }).click()
  await bob.page.getByRole('tab', { name: 'Blocked' }).click()
  await expect(bob.page.getByRole('button', { name: 'Unblock Alice' })).toBeVisible()

  // Alice's friend list empties live and her composer is replaced.
  await expect(alice.page.getByText("You can't message this user.")).toBeVisible()
  await expect(alice.page.getByLabel('Message @Bob')).toHaveCount(0)
})

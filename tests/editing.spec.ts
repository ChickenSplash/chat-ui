import { expect, test, type Page, type Locator } from '@playwright/test'
import { befriend, confirmModal, twoGuests, unique } from './helpers'

const message = (page: Page, body: string) => page.getByTestId('message').filter({ has: page.locator('p').filter({ hasText: body }) })

async function action(row: Locator, name: string) {
  await row.hover()
  await row.getByRole('button', { name, exact: true }).click()
}

async function say(page: Page, name: string, body: string) {
  const input = page.getByLabel(`Message @${name}`)
  await input.fill(body)
  await input.press('Enter')
  await expect(message(page, body)).toBeVisible()
}

async function startDm(browser: Parameters<typeof twoGuests>[0]) {
  const [alice, bob] = await twoGuests(browser)
  await befriend(alice, bob)
  await alice.page.getByRole('button', { name: 'Message Bob' }).click()
  await say(alice.page, 'Bob', 'Original message')
  await bob.page.getByRole('list', { name: 'Direct messages' }).getByRole('link', { name: /Alice/ }).click()
  await expect(message(bob.page, 'Original message')).toBeVisible()
  return [alice, bob]
}

test('edit inline, cancel, use arrow-up and update the other browser without a duplicate', async ({ browser }) => {
  const [alice, bob] = await startDm(browser)
  const row = message(alice.page, 'Original message')
  await action(row, 'Edit message')
  await alice.page.getByLabel('Edit message text').fill('Cancelled text')
  await alice.page.getByLabel('Edit message text').press('Escape')
  await expect(row).toBeVisible()
  await expect(alice.page.getByLabel('Edit message text')).toHaveCount(0)

  await alice.page.getByLabel('Message @Bob').press('ArrowUp')
  const editor = alice.page.getByLabel('Edit message text')
  await expect(editor).toHaveValue('Original message')
  await editor.fill('Corrected message')
  await editor.press('Shift+Enter')
  await editor.press('a')
  await editor.press('Enter')
  await expect(message(bob.page, 'Corrected message')).toContainText('(edited)')
  await expect(bob.page.getByTestId('message')).toHaveCount(1)
  await expect(alice.page.getByTestId('message')).toHaveCount(1)
  await message(bob.page, 'Corrected message').hover()
  await expect(bob.page.getByRole('button', { name: 'Edit message', exact: true })).toHaveCount(0)
  await bob.page.reload()
  await expect(message(bob.page, 'Corrected message')).toContainText('(edited)')
})

test('failed edits keep your draft and can be retried; unchanged saves do not say edited', async ({ browser }) => {
  const [alice] = await startDm(browser)
  await action(message(alice.page, 'Original message'), 'Edit message')
  await alice.page.getByLabel('Edit message text').press('Enter')
  await expect(alice.page.getByLabel('Edit message text')).toHaveCount(0)
  await expect(alice.page.getByTestId('message')).not.toContainText('(edited)')

  await action(message(alice.page, 'Original message'), 'Edit message')
  await alice.page.route('**/api/conversations/*/messages/*', async (route) => {
    if (route.request().method() === 'PATCH') await route.fulfill({ status: 500, json: { message: 'Try again later.' } })
    else await route.continue()
  })
  const editor = alice.page.getByLabel('Edit message text')
  await editor.fill('Retried edit')
  await editor.press('Enter')
  await expect(alice.page.getByRole('alert')).toContainText('Try again later.')
  await expect(editor).toHaveValue('Retried edit')
  await alice.page.unroute('**/api/conversations/*/messages/*')
  await alice.page.getByRole('button', { name: 'Save (Enter)', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await expect(message(alice.page, 'Retried edit')).toContainText('(edited)')
})

test('replies quote and jump to originals, then reflect edits and deletion live and on reload', async ({ browser }) => {
  const [alice, bob] = await startDm(browser)
  await action(message(bob.page, 'Original message'), 'Reply to message')
  await expect(bob.page.getByTestId('replying-to')).toContainText('Replying to Alice')
  await bob.page.getByLabel('Message @Alice').press('Escape')
  await expect(bob.page.getByTestId('replying-to')).toHaveCount(0)
  await action(message(bob.page, 'Original message'), 'Reply to message')
  await say(bob.page, 'Alice', 'A reply to you')
  const quote = message(alice.page, 'A reply to you').getByTestId('reply-preview')
  await expect(quote).toHaveText('Alice: Original message')
  await quote.click()
  await expect(message(alice.page, 'Original message')).toBeInViewport()

  await action(message(alice.page, 'Original message'), 'Edit message')
  await alice.page.getByLabel('Edit message text').fill('Updated original')
  await alice.page.getByLabel('Edit message text').press('Enter')
  await expect(message(bob.page, 'A reply to you').getByTestId('reply-preview')).toHaveText('Alice: Updated original')
  await bob.page.reload()
  await expect(message(bob.page, 'A reply to you').getByTestId('reply-preview')).toHaveText('Alice: Updated original')

  await action(message(alice.page, 'Updated original'), 'Delete message')
  await confirmModal(alice.page)
  await expect(quote).toHaveText('Original message deleted')
  await expect(message(bob.page, 'A reply to you').getByTestId('reply-preview')).toBeDisabled()
  await bob.page.reload()
  await expect(message(bob.page, 'A reply to you').getByTestId('reply-preview')).toHaveText('Original message deleted')
})

test('a failed reply retains its target when retried', async ({ browser }) => {
  const [alice, bob] = await startDm(browser)
  await action(message(bob.page, 'Original message'), 'Reply to message')
  await bob.page.route('**/api/conversations/*/messages', async (route) => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 500, json: { message: 'Failed' } })
    else await route.continue()
  })
  await bob.page.getByLabel('Message @Alice').fill('Retry this reply')
  await bob.page.getByLabel('Message @Alice').press('Enter')
  const failed = bob.page.getByTestId('message-failed')
  await expect(failed.getByTestId('reply-preview')).toHaveText('Alice: Original message')
  await bob.page.unroute('**/api/conversations/*/messages')
  await failed.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(message(alice.page, 'Retry this reply').getByTestId('reply-preview')).toHaveText('Alice: Original message')
  await expect(failed).toHaveCount(0)
})

test('groups support edits and replies, without exposing blocked authors through quotes', async ({ browser }) => {
  const [alice, bob] = await twoGuests(browser)
  const name = `Replies ${unique()}`
  await alice.page.getByRole('button', { name: 'Create or join a group' }).click()
  await alice.page.getByLabel('Group name').fill(name)
  await alice.page.getByRole('button', { name: 'Create group' }).click()
  await expect(alice.page.getByRole('heading', { name: `Welcome to ${name}` })).toBeVisible()
  await alice.page.getByRole('button', { name: 'Group settings' }).click()
  await alice.page.getByRole('button', { name: 'Invites' }).click()
  const invite = new URL((await alice.page.getByTestId('invite-link').textContent())!).pathname
  await alice.page.getByRole('button', { name: 'Close' }).click()
  await bob.page.goto(invite)
  await bob.page.getByRole('button', { name: `Join ${name}` }).click()
  await expect(bob.page.getByLabel(`Message ${name}`)).toBeVisible()
  await bob.page.getByLabel(`Message ${name}`).fill('Group original')
  await bob.page.getByLabel(`Message ${name}`).press('Enter')
  await action(message(alice.page, 'Group original'), 'Reply to message')
  await alice.page.getByLabel(`Message ${name}`).fill('Group reply')
  await alice.page.getByLabel(`Message ${name}`).press('Enter')
  await expect(message(bob.page, 'Group reply').getByTestId('reply-preview')).toHaveText('Bob: Group original')
  await action(message(bob.page, 'Group original'), 'Edit message')
  await bob.page.getByLabel('Edit message text').fill('Group corrected')
  await bob.page.getByLabel('Edit message text').press('Enter')
  await expect(message(alice.page, 'Group reply').getByTestId('reply-preview')).toHaveText('Bob: Group corrected')
  await alice.page.evaluate(async (id) => {
    const token = decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)![1])
    const response = await fetch(`/api/blocks/${id}`, { method: 'PUT', headers: { 'X-XSRF-TOKEN': token, Accept: 'application/json' } })
    if (!response.ok) throw new Error('Block failed')
  }, bob.id)
  await expect(message(alice.page, 'Group reply').getByTestId('reply-preview')).toHaveText('Blocked message')
})

test('jumping to an older original loads the missing history page', async ({ browser }) => {
  test.setTimeout(120_000)
  const [alice, bob] = await startDm(browser)
  const originalId = Number(await message(alice.page, 'Original message').getAttribute('data-message-id'))
  const conversationId = Number(new URL(alice.page.url()).pathname.split('/').at(-1))
  // Use the real API and honour its limit. Tall fillers keep the history sentinel offscreen.
  await alice.page.evaluate(async (id) => {
    const token = decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)![1])
    for (let i = 0; i < 51; i++) {
      let response: Response
      do {
        response = await fetch(`/api/conversations/${id}/messages`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
          body: JSON.stringify({ body: `Filler ${i}\nline\nline\nline`, nonce: `filler-${i}` }),
        })
        if (response.status === 429) await new Promise((resolve) => setTimeout(resolve, 10_100))
      } while (response.status === 429)
      if (!response.ok) throw new Error(`Send failed: ${response.status}`)
    }
  }, conversationId)
  await bob.page.evaluate(async ({ id, original }) => {
    const token = decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)![1])
    const response = await fetch(`/api/conversations/${id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
      body: JSON.stringify({ body: 'Distant reply', reply_to_message_id: original }),
    })
    if (!response.ok) throw new Error('Reply failed')
  }, { id: conversationId, original: originalId })
  await bob.page.reload()
  await expect(message(bob.page, 'Distant reply')).toBeVisible()
  await expect(bob.page.locator(`[data-message-id="${originalId}"]`)).toHaveCount(0)
  await alice.page.evaluate(async ({ id, original }) => {
    const token = decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)![1])
    const response = await fetch(`/api/conversations/${id}/messages/${original}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
      body: JSON.stringify({ body: 'Updated distant original' }),
    })
    if (!response.ok) throw new Error('Edit failed')
  }, { id: conversationId, original: originalId })
  await expect(message(bob.page, 'Distant reply').getByTestId('reply-preview')).toHaveText('Alice: Updated distant original')
  await expect(bob.page.locator(`[data-message-id="${originalId}"]`)).toHaveCount(0)
  await message(bob.page, 'Distant reply').getByTestId('reply-preview').click()
  await expect(bob.page.locator(`[data-message-id="${originalId}"]`)).toBeInViewport()
})

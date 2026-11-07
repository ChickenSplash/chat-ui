import { expect, test, type Browser, type Page } from '@playwright/test'
import { joinAsGuest, ownIp, unique } from './helpers'

type Person = { page: Page; id: string; name: string }

/** Each person in their own browser context (separate cookies, separate WebSocket). */
async function people(browser: Browser, ...names: string[]): Promise<Person[]> {
  return Promise.all(
    names.map(async (name) => {
      const context = await browser.newContext()
      await ownIp(context)
      const page = await context.newPage()
      return { page, name, id: await joinAsGuest(page, name) }
    }),
  )
}

async function createGroup(page: Page, name: string, visibility: 'Public' | 'Private') {
  await page.getByRole('link', { name: 'Create or join a group' }).click()
  await page.getByLabel('Group name').fill(name)
  await page.getByRole('radio', { name: new RegExp(`^${visibility}`) }).check()
  await page.getByRole('button', { name: 'Create group' }).click()
  await expect(page.getByRole('heading', { name: `Welcome to ${name}` })).toBeVisible()
}

async function say(page: Page, group: string, text: string) {
  const box = page.getByLabel(`Message ${group}`)
  await box.fill(text)
  await box.press('Enter')
  await expect(page.getByTestId('message').filter({ hasText: text })).toBeVisible()
}

const members = (page: Page) => page.getByRole('complementary', { name: 'Members' })

async function memberAction(page: Page, member: string, action: string, { confirm = true } = {}) {
  await members(page).getByRole('button', { name: new RegExp(`^${member}\\b`) }).click()
  if (confirm) page.once('dialog', (dialog) => dialog.accept())
  await members(page).getByRole('button', { name: action }).click()
}

async function inviteLink(page: Page) {
  await page.getByRole('link', { name: 'Group settings' }).click()
  const link = (await page.getByTestId('invite-link').textContent())!
  await page.getByRole('link', { name: 'Back to the chat' }).click()
  return new URL(link).pathname
}

test('a public group is found under Explore, joined and chatted in live', async ({ browser }) => {
  const [alice, bob] = await people(browser, 'Alice', 'Bob')
  const name = `Cyclists ${unique()}`
  await createGroup(alice.page, name, 'Public')

  await bob.page.getByRole('link', { name: 'Explore public groups' }).click()
  await bob.page.getByLabel('Search groups').fill(name)
  await bob.page.getByRole('button', { name: `Join ${name}` }).click()
  await expect(bob.page.getByRole('heading', { name: `Welcome to ${name}` })).toBeVisible()
  await expect(bob.page.getByRole('list', { name: 'Groups' }).getByRole('link', { name })).toBeVisible()

  // Alice sees Bob arrive without refreshing.
  await expect(alice.page.getByTestId('system-message')).toContainText('Bob joined the group.')
  await expect(members(alice.page)).toContainText('Bob')

  await say(bob.page, name, 'Hi everyone')
  await expect(alice.page.getByTestId('message').filter({ hasText: 'Hi everyone' })).toBeVisible()

  // An unread badge on the rail while Alice is elsewhere.
  await alice.page.getByRole('link', { name: 'Direct messages' }).click()
  await say(bob.page, name, 'Anyone there?')
  await expect(alice.page.getByRole('list', { name: 'Groups' }).getByRole('link', { name })).toContainText('1')
})

test('a private group is joined with its invite link', async ({ browser }) => {
  const [alice, bob] = await people(browser, 'Alice', 'Bob')
  const name = `Secret ${unique()}`
  await createGroup(alice.page, name, 'Private')
  const link = await inviteLink(alice.page)

  // Private groups don't show under Explore.
  await bob.page.getByRole('link', { name: 'Explore public groups' }).click()
  await bob.page.getByLabel('Search groups').fill(name)
  await expect(bob.page.getByText('No public groups match that name.')).toBeVisible()

  await bob.page.goto(link)
  await expect(bob.page.getByText("You've been invited to join a group")).toBeVisible()
  await bob.page.getByRole('button', { name: `Join ${name}` }).click()
  await expect(bob.page.getByRole('heading', { name: `Welcome to ${name}` })).toBeVisible()
  await expect(members(alice.page)).toContainText('Bob')
})

test('roles, kicking and banning follow rank', async ({ browser }) => {
  const [alice, bob, carol] = await people(browser, 'Alice', 'Bob', 'Carol')
  const name = `Mods ${unique()}`
  await createGroup(alice.page, name, 'Private')
  const link = await inviteLink(alice.page)

  for (const person of [bob, carol]) {
    await person.page.goto(link)
    await person.page.getByRole('button', { name: `Join ${name}` }).click()
    await expect(person.page.getByRole('heading', { name: `Welcome to ${name}` })).toBeVisible()
  }

  // Alice makes Bob a mod; a regular member sees no moderation options.
  await memberAction(alice.page, 'Bob', 'Make a mod', { confirm: false })
  await expect(alice.page.getByTestId('system-message').last()).toContainText('Alice made Bob a mod.')
  await members(carol.page).getByRole('button', { name: /^Bob\b/ }).click()
  await expect(members(carol.page).getByRole('button', { name: /Kick/ })).toHaveCount(0)

  // Bob, now a mod, can delete Carol's message and kick her, but cannot touch Alice.
  await say(carol.page, name, 'spam spam spam')
  const spam = bob.page.getByTestId('message').filter({ hasText: 'spam spam spam' })
  await spam.hover()
  bob.page.once('dialog', (dialog) => dialog.accept())
  await spam.getByRole('button', { name: 'Delete message' }).click()
  await expect(carol.page.getByText('spam spam spam')).toHaveCount(0)

  await members(bob.page).getByRole('button', { name: /^Alice\b/ }).click()
  await expect(members(bob.page).getByRole('button', { name: /Kick/ })).toHaveCount(0)
  await memberAction(bob.page, 'Carol', 'Kick Carol')

  // Carol is moved out live and the group leaves her rail.
  await expect(carol.page.getByRole('heading', { name: 'Friends', exact: true })).toBeVisible()
  await expect(carol.page.getByRole('list', { name: 'Groups' }).getByRole('link', { name })).toHaveCount(0)
  await expect(alice.page.getByTestId('system-message').last()).toContainText('Bob kicked Carol.')

  // A kick isn't a ban: she can come back. Then Alice bans her and she can't.
  await carol.page.goto(link)
  await carol.page.getByRole('button', { name: `Join ${name}` }).click()
  await expect(members(alice.page)).toContainText('Carol')
  await memberAction(alice.page, 'Carol', 'Ban Carol')
  await expect(carol.page.getByRole('heading', { name: 'Friends', exact: true })).toBeVisible()

  await carol.page.goto(link)
  await carol.page.getByRole('button', { name: `Join ${name}` }).click()
  await expect(carol.page.getByText('You are banned from this group.')).toBeVisible()

  await alice.page.getByRole('link', { name: 'Group settings' }).click()
  await alice.page.getByRole('button', { name: 'Unban Carol' }).click()
  await carol.page.getByRole('button', { name: `Join ${name}` }).click()
  await expect(carol.page.getByRole('heading', { name: `Welcome to ${name}` })).toBeVisible()
})

test('when the owner leaves, the highest ranked member takes over', async ({ browser }) => {
  const [alice, bob] = await people(browser, 'Alice', 'Bob')
  const name = `Handover ${unique()}`
  await createGroup(alice.page, name, 'Public')

  await bob.page.getByRole('link', { name: 'Explore public groups' }).click()
  await bob.page.getByLabel('Search groups').fill(name)
  await bob.page.getByRole('button', { name: `Join ${name}` }).click()
  await expect(members(alice.page)).toContainText('Bob')

  await alice.page.getByRole('link', { name: 'Group settings' }).click()
  alice.page.once('dialog', (dialog) => dialog.accept())
  await alice.page.getByRole('button', { name: 'Leave group' }).click()
  await expect(alice.page.getByRole('list', { name: 'Groups' }).getByRole('link', { name })).toHaveCount(0)

  await expect(bob.page.getByTestId('system-message').last()).toContainText('Bob is now the owner.')
  await expect(members(bob.page).getByRole('heading', { name: 'Owner · 1' })).toBeVisible()
  await bob.page.getByRole('link', { name: 'Group settings' }).click()
  await expect(bob.page.getByRole('button', { name: 'Delete group' })).toBeVisible()
})

test("a blocked person's group messages collapse until shown", async ({ browser }) => {
  const [alice, bob] = await people(browser, 'Alice', 'Bob')
  const name = `Blocks ${unique()}`
  await createGroup(alice.page, name, 'Public')

  await bob.page.getByRole('link', { name: 'Explore public groups' }).click()
  await bob.page.getByLabel('Search groups').fill(name)
  await bob.page.getByRole('button', { name: `Join ${name}` }).click()
  await say(bob.page, name, 'you cannot see me')

  // Blocking from the friends list needs a friendship; the API call is the same one it makes.
  await alice.page.evaluate(async (id) => {
    const token = decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]*)/)![1])
    const response = await fetch(`/api/blocks/${id}`, { method: 'PUT', headers: { 'X-XSRF-TOKEN': token, Accept: 'application/json' } })
    if (!response.ok) throw new Error(`block failed: ${response.status}`)
  }, bob.id)
  await alice.page.reload()

  await expect(alice.page.getByTestId('message-blocked')).toBeVisible()
  await expect(alice.page.getByText('you cannot see me')).toHaveCount(0)
  await alice.page.getByRole('button', { name: 'Show' }).click()
  await expect(alice.page.getByText('you cannot see me')).toBeVisible()
})

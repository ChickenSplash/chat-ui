import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '../components/Avatar'
import { NavButton } from '../components/NavButton'
import { Icon, type IconName } from '../components/icons'
import { Badge } from '../components/Layout'
import { GuestBadge } from '../components/ui'
import { ApiError } from '../lib/api'
import { useConfirm } from '../lib/confirm'
import { useOpenDm } from '../lib/conversations'
import {
  useAcceptFriend,
  useBlock,
  useBlocks,
  useFriends,
  useRemoveFriend,
  useSendFriendRequest,
  useUnblock,
  type PublicUser,
} from '../lib/friends'
import { STATUS_LABEL, useStatusOf } from '../lib/presence'

type Tab = 'all' | 'pending' | 'blocked' | 'add'

export function Friends() {
  const [tab, setTab] = useState<Tab>('all')
  const friends = useFriends()
  const incoming = friends.data?.filter((f) => f.status === 'incoming').length ?? 0

  const tabButton = (id: Tab, label: string, extra?: ReactNode) => (
    <button
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-[15px] font-medium transition ${
        tab === id ? 'bg-hover text-white' : 'text-zinc-400 hover:bg-hover/60 hover:text-zinc-200'
      }`}
    >
      {label}
      {extra}
    </button>
  )

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-black/20 px-4 shadow-sm">
        <NavButton />
        <h1 className="flex items-center gap-2 font-semibold">
          <Icon name="users" className="size-6 text-zinc-400" /> Friends
        </h1>
        <div className="h-6 w-px bg-zinc-600" />
        <div role="tablist" className="flex items-center gap-2">
          {tabButton('all', 'All')}
          {tabButton('pending', 'Pending', incoming > 0 && <Badge>{incoming}</Badge>)}
          {tabButton('blocked', 'Blocked')}
          <button
            role="tab"
            aria-selected={tab === 'add'}
            onClick={() => setTab('add')}
            className={`rounded px-2 py-0.5 text-[15px] font-medium ${
              tab === 'add' ? 'text-emerald-400' : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            Add Friend
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === 'all' && <FriendList />}
        {tab === 'pending' && <PendingList />}
        {tab === 'blocked' && <BlockedList />}
        {tab === 'add' && <AddFriend />}
      </div>
    </>
  )
}

function FriendList() {
  const friends = useFriends()
  const remove = useRemoveFriend()
  const block = useBlock()
  const openDm = useOpenDm()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const list = friends.data?.filter((f) => f.status === 'friend') ?? []

  const message = (user: PublicUser) =>
    openDm.mutate(user.id, { onSuccess: (conversation) => navigate(`/dm/${conversation.id}`) })

  return (
    <Section title={`All friends · ${list.length}`} empty={friends.isSuccess && list.length === 0 && 'No friends yet. Add someone by their ID.'}>
      {list.map(({ user }) => (
        <Row key={user.id} user={user} presence>
          <Action icon="chat" label={`Message ${user.display_name}`} onClick={() => message(user)} />
          <Action
            icon="userMinus"
            label={`Remove ${user.display_name}`}
            danger
            onClick={async () =>
              (await confirm({
                title: `Remove ${user.display_name}`,
                body: `Remove ${user.display_name} from your friends? You can still message each other.`,
                action: 'Remove friend',
                danger: true,
              })) && remove.mutate(user.id)
            }
          />
          <Action
            icon="block"
            label={`Block ${user.display_name}`}
            danger
            onClick={async () =>
              (await confirm({
                title: `Block ${user.display_name}`,
                body: "They won't be able to message you, and their group messages are hidden from you.",
                action: 'Block',
                danger: true,
              })) && block.mutate(user.id)
            }
          />
        </Row>
      ))}
    </Section>
  )
}

function PendingList() {
  const friends = useFriends()
  const accept = useAcceptFriend()
  const remove = useRemoveFriend()
  const list = friends.data?.filter((f) => f.status !== 'friend') ?? []

  return (
    <Section title={`Pending · ${list.length}`} empty={friends.isSuccess && list.length === 0 && 'No pending friend requests.'}>
      {list.map(({ user, status }) => (
        <Row key={user.id} user={user} note={status === 'incoming' ? 'Incoming friend request' : 'Outgoing friend request'}>
          {status === 'incoming' && (
            <Action icon="check" label={`Accept ${user.display_name}`} onClick={() => accept.mutate(user.id)} />
          )}
          <Action
            icon="x"
            label={status === 'incoming' ? `Decline ${user.display_name}` : `Cancel request to ${user.display_name}`}
            danger
            onClick={() => remove.mutate(user.id)}
          />
        </Row>
      ))}
    </Section>
  )
}

function BlockedList() {
  const blocks = useBlocks()
  const unblock = useUnblock()
  const list = blocks.data ?? []

  return (
    <Section title={`Blocked · ${list.length}`} empty={blocks.isSuccess && list.length === 0 && "You haven't blocked anyone."}>
      {list.map((user) => (
        <Row key={user.id} user={user} note="Blocked">
          <Action icon="x" label={`Unblock ${user.display_name}`} onClick={() => unblock.mutate(user.id)} />
        </Row>
      ))}
    </Section>
  )
}

function AddFriend() {
  const send = useSendFriendRequest()
  const [id, setId] = useState('')
  const error = send.error instanceof ApiError ? (send.error.field('id') ?? send.error.message) : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    send.mutate(id, { onSuccess: () => setId('') })
  }

  return (
    <section>
      <h2 className="font-semibold uppercase">Add friend</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Add friends with their ID. You'll find yours by clicking your name in the bottom left.
      </p>
      <form
        onSubmit={submit}
        className={`mt-4 flex items-center gap-2 rounded-lg bg-rail p-2 ring-1 ${
          error ? 'ring-red-500' : send.isSuccess ? 'ring-emerald-500' : 'ring-transparent focus-within:ring-indigo-500'
        }`}
      >
        <input
          aria-label="Their ID"
          placeholder="Enter an ID, e.g. k7m2qx9p"
          value={id}
          onChange={(e) => {
            setId(e.target.value)
            send.reset()
          }}
          className="flex-1 bg-transparent px-2 text-zinc-100 outline-none placeholder:text-zinc-500"
          autoFocus
        />
        <button
          type="submit"
          disabled={!id.trim() || send.isPending}
          className="rounded bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          Send Friend Request
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {send.data && (
        <p className="mt-2 text-sm text-emerald-400">
          {send.data.status === 'friend'
            ? `You and ${send.data.user.display_name} are now friends.`
            : `Friend request sent to ${send.data.user.display_name}.`}
        </p>
      )}
    </section>
  )
}

function Section({ title, empty, children }: { title: string; empty: string | false; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-zinc-400 uppercase">{title}</h2>
      {empty ? <p className="py-8 text-center text-zinc-500">{empty}</p> : <ul className="divide-y divide-zinc-700/60">{children}</ul>}
    </section>
  )
}

/** A person in one of the lists. Friends (`presence`) show their status as the note. */
function Row({ user, note, presence, children }: { user: PublicUser; note?: string; presence?: boolean; children: ReactNode }) {
  const status = useStatusOf(user.id)
  const shownNote = presence ? STATUS_LABEL[status] : note

  return (
    <li data-testid={`friend-${user.id}`} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-hover/50">
      <Avatar user={user} status={presence ? status : undefined} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-semibold">
          {user.display_name}
          {user.is_guest && <GuestBadge />}
          <span className="text-sm font-normal text-zinc-500 opacity-0 transition group-hover:opacity-100">#{user.id}</span>
        </p>
        {shownNote && <p className="text-xs text-zinc-400">{shownNote}</p>}
      </div>
      <div className="flex gap-2">{children}</div>
    </li>
  )
}

function Action({ icon, label, danger, onClick }: { icon: IconName; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-full bg-side p-2 text-zinc-400 transition ${danger ? 'hover:text-red-400' : 'hover:text-zinc-100'}`}
    >
      <Icon name={icon} />
    </button>
  )
}

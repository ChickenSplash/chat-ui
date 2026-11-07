import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/icons'
import { Button, ErrorNote, Field } from '../components/ui'
import { ApiError } from '../lib/api'
import type { Group } from '../lib/conversations'
import {
  inviteUrl,
  RANK,
  ROLE_LABEL,
  useBans,
  useDeleteGroup,
  useGroupPage,
  useLeaveGroup,
  useResetInvite,
  useUnban,
  useUpdateGroup,
} from '../lib/groups'

export function GroupSettings() {
  const { group, lost } = useGroupPage()

  if (lost) return <Navigate to="/" replace />
  if (!group) return null

  const admin = RANK[group.role] >= RANK.admin

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-4 shadow-sm">
        <Link to={`/groups/${group.id}`} aria-label="Back to the chat" className="rounded p-1 text-zinc-400 hover:text-zinc-200">
          <Icon name="arrowRight" className="size-5 rotate-180" />
        </Link>
        <h1 className="font-semibold">{group.name} settings</h1>
        <span className="ml-2 rounded bg-rail px-1.5 py-0.5 text-xs text-zinc-400">You: {ROLE_LABEL[group.role]}</span>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-lg space-y-8">
          {admin && <Details group={group} />}
          <Invite group={group} />
          {admin && <Bans group={group} />}
          <DangerZone group={group} />
        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-zinc-400 uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Details({ group }: { group: Group }) {
  const update = useUpdateGroup(group.id)
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [visibility, setVisibility] = useState(group.visibility)
  const error = update.error instanceof ApiError ? update.error : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    update.mutate({ name, description, visibility })
  }

  return (
    <Section title="Overview">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Group name" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} error={error?.field('name')} />
        <Field
          label="Description"
          value={description}
          maxLength={200}
          onChange={(e) => setDescription(e.target.value)}
          error={error?.field('description')}
        />
        <VisibilityChoice value={visibility} onChange={setVisibility} />
        <ErrorNote>{error && !error.field('name') && !error.field('description') && error.message}</ErrorNote>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={update.isPending}>
            Save changes
          </Button>
          {update.isSuccess && <span className="text-sm text-emerald-400">Saved.</span>}
        </div>
      </form>
    </Section>
  )
}

export function VisibilityChoice({ value, onChange }: { value: 'public' | 'private'; onChange: (v: 'public' | 'private') => void }) {
  const option = (v: 'public' | 'private', title: string, note: string) => (
    <label className={`flex cursor-pointer gap-3 rounded-lg p-3 ring-1 ${value === v ? 'bg-hover ring-indigo-500' : 'bg-rail ring-transparent'}`}>
      <input type="radio" name="visibility" checked={value === v} onChange={() => onChange(v)} className="mt-1 accent-indigo-500" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-zinc-400">{note}</span>
      </span>
    </label>
  )

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-zinc-300">Who can join</legend>
      {option('public', 'Public', 'Anyone can find it under Explore and join.')}
      {option('private', 'Private', 'Only people with the invite link can join.')}
    </fieldset>
  )
}

function Invite({ group }: { group: Group }) {
  const reset = useResetInvite(group.id)
  const [copied, setCopied] = useState(false)
  const url = inviteUrl(group.invite_code)

  const copy = async () => {
    await navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Section title="Invite link">
      <div className="flex items-center gap-2 rounded-lg bg-rail p-2">
        <code data-testid="invite-link" className="min-w-0 flex-1 truncate px-2 text-sm">
          {url}
        </code>
        <Button onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
      </div>
      {RANK[group.role] >= RANK.admin && (
        <p className="mt-2 text-sm text-zinc-400">
          Leaked?{' '}
          <button
            onClick={() => confirm('Make a new link? The current one stops working.') && reset.mutate()}
            className="font-medium text-sky-400 hover:underline"
          >
            Reset the link
          </button>
        </p>
      )}
    </Section>
  )
}

function Bans({ group }: { group: Group }) {
  const bans = useBans(group.id, true)
  const unban = useUnban(group.id)
  const list = bans.data ?? []

  return (
    <Section title={`Bans · ${list.length}`}>
      {bans.isSuccess && list.length === 0 && <p className="text-sm text-zinc-500">Nobody is banned.</p>}
      <ul className="space-y-1">
        {list.map((user) => (
          <li key={user.id} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-hover/50">
            <Avatar user={user} size="sm" />
            <span className="flex-1 truncate">{user.display_name}</span>
            <Button variant="ghost" onClick={() => unban.mutate(user.id)}>
              Unban {user.display_name}
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function DangerZone({ group }: { group: Group }) {
  const navigate = useNavigate()
  const leave = useLeaveGroup(group.id)
  const remove = useDeleteGroup(group.id)
  const owner = group.role === 'owner'
  const error = leave.error ?? remove.error

  const confirmLeave = () =>
    confirm(
      owner && group.member_count > 1
        ? `Leave ${group.name}? Ownership passes to the highest ranked member who joined first.`
        : group.member_count === 1
          ? `Leave ${group.name}? You're the last member, so the group will be deleted.`
          : `Leave ${group.name}?`,
    ) && leave.mutate(undefined, { onSuccess: () => navigate('/') })

  const confirmDelete = () =>
    prompt(`This deletes ${group.name} and all its messages for everyone. Type the group name to confirm.`) === group.name &&
    remove.mutate(undefined, { onSuccess: () => navigate('/') })

  return (
    <Section title="Danger zone">
      <div className="flex flex-wrap gap-3">
        <button onClick={confirmLeave} className="rounded-lg bg-rail px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500 hover:text-white">
          Leave group
        </button>
        {owner && (
          <button onClick={confirmDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500">
            Delete group
          </button>
        )}
      </div>
      {error instanceof ApiError && <p className="mt-2 text-sm text-red-400">{error.message}</p>}
    </Section>
  )
}

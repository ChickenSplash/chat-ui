import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '../lib/api'
import { useConfirm } from '../lib/confirm'
import type { Group } from '../lib/conversations'
import {
  inviteUrl,
  RANK,
  ROLE_LABEL,
  useBans,
  useDeleteGroup,
  useLeaveGroup,
  useResetInvite,
  useUnban,
  useUpdateGroup,
} from '../lib/groups'
import { Avatar } from './Avatar'
import { SettingsBlock, SettingsModal, type SettingsAction, type SettingsSection } from './SettingsModal'
import { Button, ErrorNote, Field, Label } from './ui'

type Section = 'overview' | 'invites' | 'bans'

export function GroupSettings({ group, onClose }: { group: Group; onClose: () => void }) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const leave = useLeaveGroup(group.id)
  const remove = useDeleteGroup(group.id)
  const admin = RANK[group.role] >= RANK.admin
  const owner = group.role === 'owner'

  const sections: SettingsSection<Section>[] = [
    ...(admin ? [{ id: 'overview' as const, label: 'Overview', icon: 'info' as const, group: group.name }] : []),
    { id: 'invites', label: 'Invites', icon: 'link', group: group.name },
    ...(admin ? [{ id: 'bans' as const, label: 'Bans', icon: 'block' as const, group: 'Moderation' }] : []),
  ]
  const [section, setSection] = useState<Section>(sections[0].id)

  const gone = { onSuccess: () => (onClose(), navigate('/')) }

  const confirmLeave = async () => {
    const ok = await confirm({
      title: `Leave ${group.name}`,
      body:
        owner && group.member_count > 1
          ? 'Ownership passes to the highest ranked member who joined first.'
          : group.member_count === 1
            ? "You're the last member, so the group will be deleted."
            : "You won't be able to rejoin unless you're invited again or it's public.",
      action: 'Leave group',
      danger: true,
    })
    if (ok) leave.mutate(undefined, gone)
  }

  const confirmDelete = async () => {
    const ok = await confirm({
      title: `Delete ${group.name}`,
      body: 'This deletes the group and all its messages for everyone. It cannot be undone.',
      action: 'Delete group',
      danger: true,
      typeToConfirm: group.name,
    })
    if (ok) remove.mutate(undefined, gone)
  }

  const actions: SettingsAction[] = [
    { label: 'Leave group', icon: 'logout', danger: true, onClick: confirmLeave },
    ...(owner ? [{ label: 'Delete group', icon: 'trash' as const, danger: true, onClick: confirmDelete }] : []),
  ]
  const error = leave.error ?? remove.error

  return (
    <SettingsModal
      label="Group settings"
      sections={sections}
      active={section}
      onSelect={setSection}
      actions={actions}
      footer={`You're ${RANK[group.role] >= RANK.admin ? 'an' : 'a'} ${ROLE_LABEL[group.role].toLowerCase()} here.`}
      onClose={onClose}
    >
      {error instanceof ApiError && <ErrorNote>{error.message}</ErrorNote>}
      {section === 'overview' && admin && <Overview group={group} />}
      {section === 'invites' && <Invite group={group} />}
      {section === 'bans' && admin && <Bans group={group} />}
    </SettingsModal>
  )
}

function Overview({ group }: { group: Group }) {
  const update = useUpdateGroup(group.id)
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [visibility, setVisibility] = useState(group.visibility)
  const error = update.error instanceof ApiError ? update.error : undefined
  const changed = name !== group.name || description !== (group.description ?? '') || visibility !== group.visibility

  const submit = (event: FormEvent) => {
    event.preventDefault()
    update.mutate({ name, description, visibility })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
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
        <Button type="submit" disabled={update.isPending || !changed}>
          Save changes
        </Button>
        {update.isSuccess && !changed && <span className="text-sm text-emerald-400">Saved</span>}
      </div>
    </form>
  )
}

export function VisibilityChoice({ value, onChange }: { value: 'public' | 'private'; onChange: (v: 'public' | 'private') => void }) {
  const option = (v: 'public' | 'private', title: string, note: string) => (
    <label
      className={`flex cursor-pointer gap-3 rounded-lg p-3 ring-1 transition ${
        value === v ? 'bg-hover ring-indigo-500' : 'bg-rail ring-transparent hover:bg-hover/50'
      }`}
    >
      <input type="radio" name="visibility" checked={value === v} onChange={() => onChange(v)} className="mt-1 accent-indigo-500" />
      <span>
        <span className="block text-sm font-medium text-zinc-100">{title}</span>
        <span className="block text-xs text-zinc-400">{note}</span>
      </span>
    </label>
  )

  return (
    <fieldset>
      <legend>
        <Label>Who can join</Label>
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {option('public', 'Public', 'Anyone can find it under Explore and join.')}
        {option('private', 'Private', 'Only people with the invite link can join.')}
      </div>
    </fieldset>
  )
}

function Invite({ group }: { group: Group }) {
  const reset = useResetInvite(group.id)
  const confirm = useConfirm()
  const [copied, setCopied] = useState(false)
  const url = inviteUrl(group.invite_code)

  const copy = async () => {
    await navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const confirmReset = async () => {
    const ok = await confirm({
      title: 'Reset the invite link',
      body: 'The current link stops working straight away. Anyone you want to invite will need the new one.',
      action: 'Reset link',
    })
    if (ok) reset.mutate()
  }

  return (
    <SettingsBlock title="Invite link" description="Anyone with this link can join, unless they're banned.">
      <div className="flex items-center gap-2 rounded-md bg-rail p-1.5 pl-3">
        <code data-testid="invite-link" className="min-w-0 flex-1 truncate text-sm text-zinc-200">
          {url}
        </code>
        <Button onClick={copy} className={copied ? 'bg-emerald-600 hover:bg-emerald-600' : ''}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {RANK[group.role] >= RANK.admin && (
        <p className="mt-3 text-sm text-zinc-400">
          Leaked?{' '}
          <button onClick={confirmReset} disabled={reset.isPending} className="font-medium text-sky-400 hover:underline">
            Reset the link
          </button>
        </p>
      )}
    </SettingsBlock>
  )
}

function Bans({ group }: { group: Group }) {
  const bans = useBans(group.id, true)
  const unban = useUnban(group.id)
  const list = bans.data ?? []

  return (
    <SettingsBlock title={`Banned · ${list.length}`} description="Banned people can't rejoin, even with the invite link.">
      {bans.isSuccess && list.length === 0 && <p className="rounded-lg bg-side px-4 py-6 text-center text-sm text-zinc-500">Nobody is banned.</p>}
      <ul className="space-y-1">
        {list.map((user) => (
          <li key={user.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-hover/50">
            <Avatar user={user} size="sm" />
            <span className="min-w-0 flex-1 truncate">{user.display_name}</span>
            <Button variant="secondary" onClick={() => unban.mutate(user.id)} aria-label={`Unban ${user.display_name}`}>
              Unban
            </Button>
          </li>
        ))}
      </ul>
    </SettingsBlock>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icon } from '../components/icons'
import { Button, ErrorNote, Field } from '../components/ui'
import { ApiError } from '../lib/api'
import { inviteCodeFrom, useAcceptInvite, useCreateGroup } from '../lib/groups'
import { VisibilityChoice } from './GroupSettings'

/** Discord's "Add a server": create a group, or join one with an invite link. */
export function NewGroup() {
  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-4 shadow-sm">
        <Icon name="plus" className="size-6 text-zinc-400" />
        <h1 className="font-semibold">Create or join a group</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-lg space-y-10">
          <CreateGroup />
          <JoinByLink />
          <p className="text-sm text-zinc-400">
            Or{' '}
            <Link to="/groups/explore" className="text-sky-400 hover:underline">
              explore public groups
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  )
}

function CreateGroup() {
  const create = useCreateGroup()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const error = create.error instanceof ApiError ? create.error : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate({ name, description, visibility }, { onSuccess: (group) => navigate(`/groups/${group.id}`) })
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">Create a group</h2>
      <p className="mb-4 text-sm text-zinc-400">You'll be its owner. You can change all of this later.</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Group name" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} error={error?.field('name')} required />
        <Field
          label="Description (optional)"
          value={description}
          maxLength={200}
          onChange={(e) => setDescription(e.target.value)}
          error={error?.field('description')}
        />
        <VisibilityChoice value={visibility} onChange={setVisibility} />
        <ErrorNote>{error && !error.field('name') && !error.field('description') && error.message}</ErrorNote>
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          Create group
        </Button>
      </form>
    </section>
  )
}

function JoinByLink() {
  const accept = useAcceptInvite()
  const navigate = useNavigate()
  const [link, setLink] = useState('')
  const error = accept.error instanceof ApiError ? accept.error : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    accept.mutate(inviteCodeFrom(link), { onSuccess: (group) => navigate(`/groups/${group.id}`) })
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">Join with an invite</h2>
      <form onSubmit={submit} className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <Field
            label="Invite link or code"
            placeholder="https://chat.chickensplash.dpdns.org/invite/k7m2qx9p"
            value={link}
            onChange={(e) => {
              setLink(e.target.value)
              accept.reset()
            }}
            error={error && (error.status === 404 ? 'That invite is invalid or has been reset.' : (error.field('group') ?? error.message))}
          />
        </div>
        <Button type="submit" disabled={!link.trim() || accept.isPending} className={error ? 'mb-7' : ''}>
          Join
        </Button>
      </form>
    </section>
  )
}

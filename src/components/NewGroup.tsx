import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../lib/api'
import { inviteCodeFrom, useAcceptInvite, useCreateGroup } from '../lib/groups'
import { NAV } from '../lib/nav'
import { VisibilityChoice } from './GroupSettings'
import { Dialog } from './Modal'
import { Button, ErrorNote, Field } from './ui'

/** Discord's "Add a server": create a group, or join one with an invite link. */
export function NewGroup({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'create' | 'join'>('create')

  return mode === 'create' ? (
    <CreateGroup onClose={onClose} onJoin={() => setMode('join')} />
  ) : (
    <JoinByLink onClose={onClose} onBack={() => setMode('create')} />
  )
}

function CreateGroup({ onClose, onJoin }: { onClose: () => void; onJoin: () => void }) {
  const create = useCreateGroup()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const error = create.error instanceof ApiError ? create.error : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate(
      { name, description, visibility },
      {
        onSuccess: (group) => {
          onClose()
          navigate(`/groups/${group.id}`)
        },
      },
    )
  }

  return (
    <Dialog
      title="Create a group"
      description="You'll be its owner. You can change all of this later."
      onClose={onClose}
      onSubmit={submit}
      className="max-w-lg"
      footer={
        <>
          <p className="mr-auto text-sm text-zinc-400">
            Have an invite?{' '}
            <button type="button" onClick={onJoin} className="font-medium text-sky-400 hover:underline">
              Join a group
            </button>
          </p>
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create group'}
          </Button>
        </>
      }
    >
      <Field
        label="Group name"
        value={name}
        maxLength={50}
        onChange={(e) => setName(e.target.value)}
        error={error?.field('name')}
        required
        data-autofocus
      />
      <Field
        label="Description (optional)"
        value={description}
        maxLength={200}
        onChange={(e) => setDescription(e.target.value)}
        error={error?.field('description')}
      />
      <VisibilityChoice value={visibility} onChange={setVisibility} />
      <ErrorNote>{error && !error.field('name') && !error.field('description') && error.message}</ErrorNote>
    </Dialog>
  )
}

function JoinByLink({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const accept = useAcceptInvite()
  const navigate = useNavigate()
  const [link, setLink] = useState('')
  const error = accept.error instanceof ApiError ? accept.error : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    accept.mutate(inviteCodeFrom(link), {
      onSuccess: (group) => {
        onClose()
        navigate(`/groups/${group.id}`)
      },
    })
  }

  return (
    <Dialog
      title="Join a group"
      description="Paste an invite link someone sent you."
      onClose={onClose}
      onSubmit={submit}
      className="max-w-lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onBack} className="mr-auto">
            Back
          </Button>
          <Button type="submit" disabled={!link.trim() || accept.isPending}>
            Join group
          </Button>
        </>
      }
    >
      <Field
        label="Invite link or code"
        placeholder={`${location.origin}/invite/k7m2qx9p`}
        value={link}
        onChange={(e) => {
          setLink(e.target.value)
          accept.reset()
        }}
        error={error && (error.status === 404 ? 'That invite is invalid or has been reset.' : (error.field('group') ?? error.message))}
        hint="Links look like the one above, or just the code at the end."
        data-autofocus
      />
      <p className="text-sm text-zinc-400">
        No invite?{' '}
        <Link to="/groups/explore" state={NAV.closed} onClick={onClose} className="font-medium text-sky-400 hover:underline">
          Explore public groups
        </Link>
      </p>
    </Dialog>
  )
}

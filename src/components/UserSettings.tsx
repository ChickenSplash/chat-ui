import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api, ApiError } from '../lib/api'
import { useChangePassword, useSignOut, useUpdateProfile, type User } from '../lib/auth'
import { useRealtime, type ConnectionState } from '../lib/realtime-context'
import { Avatar } from './Avatar'
import { SettingsBlock, SettingsModal, type SettingsSection } from './SettingsModal'
import { Button, ErrorNote, Field, GuestBadge } from './ui'

type Section = 'profile' | 'developer'

const SECTIONS: SettingsSection<Section>[] = [
  { id: 'profile', label: 'Profile', icon: 'user', group: 'User settings' },
  { id: 'developer', label: 'Developer', icon: 'code', group: 'Advanced' },
]

export function UserSettings({ user, onClose }: { user: User; onClose: () => void }) {
  const [section, setSection] = useState<Section>('profile')
  const { signOut } = useSignOut(user)

  return (
    <SettingsModal
      label="User settings"
      sections={SECTIONS}
      active={section}
      onSelect={setSection}
      actions={[{ label: 'Log out', icon: 'logout', danger: true, onClick: signOut }]}
      footer={
        <Link to="/terms" className="hover:text-zinc-300 hover:underline">
          Terms and privacy
        </Link>
      }
      onClose={onClose}
    >
      {section === 'profile' && (
        <>
          <ProfileCard user={user} />
          <DisplayNameForm user={user} />
          {!user.is_guest && <PasswordForm />}
        </>
      )}
      {section === 'developer' && <Connection user={user} />}
    </SettingsModal>
  )
}

function ProfileCard({ user }: { user: User }) {
  return (
    <div className="overflow-hidden rounded-lg bg-side">
      <div className="h-20 bg-linear-to-r from-indigo-500 to-fuchsia-600" />
      <div className="flex items-end gap-4 px-4 pb-4">
        <span className="-mt-8 rounded-full ring-6 ring-side">
          <Avatar user={user} size="lg" />
        </span>
        <div className="min-w-0 flex-1 pt-3">
          <p className="flex items-center gap-2 text-lg font-semibold text-white">
            <span className="truncate">{user.display_name}</span>
            {user.is_guest && <GuestBadge />}
          </p>
          <p className="truncate text-sm text-zinc-400">
            {user.is_guest ? 'Guest account' : user.email} ·{' '}
            <code data-testid="public-id" className="font-mono">
              #{user.id}
            </code>
          </p>
        </div>
      </div>
    </div>
  )
}

function DisplayNameForm({ user }: { user: User }) {
  const update = useUpdateProfile()
  const [name, setName] = useState(user.display_name)
  const error = update.error instanceof ApiError ? update.error : null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    update.mutate({ display_name: name })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorNote>{error && error.status !== 422 ? error.message : undefined}</ErrorNote>
      <Field
        label="Display name"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          update.reset()
        }}
        maxLength={32}
        required
        error={error?.field('display_name')}
        hint="Anyone can use any name. Your ID is what makes you unique."
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={update.isPending || name === user.display_name}>
          Save
        </Button>
        {update.isSuccess && <span className="text-sm text-emerald-400">Saved</span>}
      </div>
    </form>
  )
}

const EMPTY = { current_password: '', password: '', password_confirmation: '' }

function PasswordForm() {
  const change = useChangePassword()
  const [form, setForm] = useState(EMPTY)
  const error = change.error instanceof ApiError ? change.error : null

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => {
    setForm({ ...form, [key]: e.target.value })
    change.reset()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    change.mutate(form, { onSuccess: () => setForm(EMPTY) })
  }

  return (
    <SettingsBlock title="Password">
      <form onSubmit={submit} className="space-y-4">
        <ErrorNote>{error && error.status !== 422 ? error.message : undefined}</ErrorNote>
        <Field
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={form.current_password}
          onChange={set('current_password')}
          required
          error={error?.field('current_password')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            minLength={8}
            required
            error={error?.field('password')}
          />
          <Field
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={form.password_confirmation}
            onChange={set('password_confirmation')}
            required
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={change.isPending}>
            Change password
          </Button>
          {change.isSuccess && <span className="text-sm text-emerald-400">Password changed</span>}
        </div>
      </form>
    </SettingsBlock>
  )
}

const STATE_DOT: Record<ConnectionState, string> = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-400 animate-pulse',
  disconnected: 'bg-zinc-400',
  unavailable: 'bg-red-500',
}

type Ping = { sentAt: number; roundTrip?: number }

/** A ping goes to HMS and comes back over the WebSocket: a quick health check of live updates. */
function Connection({ user }: { user: User }) {
  const { echo, state } = useRealtime()
  const [ping, setPing] = useState<Ping | null>(null)
  const [error, setError] = useState<string>()
  const pending = useRef<number | null>(null)

  useEffect(() => {
    if (!echo) return

    const onPing = () => {
      if (pending.current === null) return
      const sentAt = pending.current
      pending.current = null
      setPing({ sentAt, roundTrip: Math.round(performance.now() - sentAt) })
    }

    // Not echo.leave(): the layout listens on the same channel for messages and friends.
    const channel = echo.private(`user.${user.id}`)
    channel.listen('.ping', onPing)
    return () => {
      channel.stopListening('.ping', onPing)
    }
  }, [echo, user.id])

  const sendPing = async () => {
    setError(undefined)
    const sentAt = performance.now()
    pending.current = sentAt
    setPing({ sentAt })

    try {
      await api('POST', '/api/ping')
    } catch (e) {
      pending.current = null
      setPing(null)
      setError(e instanceof Error ? e.message : 'Ping failed.')
    }
  }

  return (
    <SettingsBlock title="Live connection" description="A ping goes to the server and comes back over the WebSocket.">
      <div className="flex items-center gap-4 rounded-lg bg-side p-4">
        <span className={`size-3 shrink-0 rounded-full ${STATE_DOT[state]}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-zinc-400">
            Status:{' '}
            <span data-testid="connection-state" className="font-medium text-zinc-100">
              {state}
            </span>
          </p>
          {ping && (
            <p data-testid="ping-result" className="text-sm text-zinc-300">
              {ping.roundTrip === undefined ? 'Waiting for the echo…' : `Pong in ${ping.roundTrip} ms`}
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          onClick={sendPing}
          disabled={state !== 'connected' || (ping !== null && ping.roundTrip === undefined)}
        >
          Ping
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </SettingsBlock>
  )
}

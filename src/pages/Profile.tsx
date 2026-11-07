import { useState, type FormEvent } from 'react'
import { Button, Card, ErrorNote, Field, GuestBadge } from '../components/ui'
import { ApiError } from '../lib/api'
import { useChangePassword, useUpdateProfile, type User } from '../lib/auth'

export function Profile({ user }: { user: User }) {
  return (
    <div className="max-w-md space-y-6">
      <DisplayNameForm user={user} />
      {!user.is_guest && <PasswordForm />}
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
    <Card>
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold">
        Profile {user.is_guest && <GuestBadge />}
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        {user.is_guest ? 'Guest account' : user.email} · ID <code className="font-mono">#{user.id}</code>
      </p>

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
        />
        <p className="text-sm text-zinc-500">Anyone can use any name. Your ID is what makes you unique.</p>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={update.isPending || name === user.display_name}>
            Save
          </Button>
          {update.isSuccess && <span className="text-sm text-emerald-600">Saved</span>}
        </div>
      </form>
    </Card>
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
    <Card>
      <h2 className="mb-6 text-lg font-semibold">Password</h2>
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
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={change.isPending}>
            Change password
          </Button>
          {change.isSuccess && <span className="text-sm text-emerald-600">Password changed</span>}
        </div>
      </form>
    </Card>
  )
}

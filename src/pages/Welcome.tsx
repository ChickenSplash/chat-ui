import { useState, type FormEvent } from 'react'
import { Icon } from '../components/icons'
import { Button, Card, ErrorNote, Field } from '../components/ui'
import { ApiError } from '../lib/api'
import { useJoinAsGuest, useLogin, useRegister } from '../lib/auth'

type Tab = 'guest' | 'login' | 'register'

const TABS: { id: Tab; label: string }[] = [
  { id: 'guest', label: 'Join as guest' },
  { id: 'login', label: 'Log in' },
  { id: 'register', label: 'Register' },
]

/** Required to join or register. Opens in a new tab so the form keeps what's typed. */
function AgreeToTerms() {
  return (
    <label className="flex items-start gap-2 text-sm text-zinc-400">
      <input type="checkbox" required className="mt-0.5 accent-indigo-500" />
      <span>
        I'm 18 or over and agree to the{' '}
        <a href="/terms" target="_blank" rel="noopener" className="text-sky-400 hover:underline">
          terms and privacy policy
        </a>
      </span>
    </label>
  )
}

/** A validation error goes under its field; anything else (rate limits, outages) goes on top. */
function problem(error: unknown) {
  if (!error) return { field: () => undefined, general: undefined }
  if (error instanceof ApiError && error.status === 422) {
    return { field: (name: string) => error.field(name), general: undefined }
  }
  if (error instanceof ApiError && error.status === 429) {
    return { field: () => undefined, general: 'Too many attempts. Wait a minute and try again.' }
  }
  return { field: () => undefined, general: error instanceof Error ? error.message : 'Something went wrong.' }
}

export function Welcome() {
  const [tab, setTab] = useState<Tab>('guest')

  return (
    <div className="min-h-dvh bg-rail text-zinc-100">
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg">
          <Icon name="chat" className="size-8" />
        </span>
        <h1 className="mb-1 text-center text-2xl font-bold tracking-tight text-white">Welcome to Chat</h1>
        <p className="mb-8 text-center text-zinc-400">Talk to friends, groups, anyone.</p>

        <Card>
          <div role="tablist" className="mb-6 grid grid-cols-3 gap-1 rounded-lg bg-rail p-1">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`rounded-md px-2 py-1.5 text-sm font-medium transition ${
                  tab === id ? 'bg-hover text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'guest' && <GuestForm />}
          {tab === 'login' && <LoginForm />}
          {tab === 'register' && <RegisterForm />}
        </Card>
      </main>
    </div>
  )
}

function GuestForm() {
  const join = useJoinAsGuest()
  const [name, setName] = useState('')
  const { field, general } = problem(join.error)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    join.mutate({ display_name: name })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorNote>{general}</ErrorNote>
      <Field
        label="Display name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={32}
        required
        autoFocus
        error={field('display_name')}
      />
      <AgreeToTerms />
      <Button type="submit" className="w-full" disabled={join.isPending}>
        {join.isPending ? 'Joining…' : 'Join'}
      </Button>
    </form>
  )
}

function LoginForm() {
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const { field, general } = problem(login.error)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate({ email, password, remember })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorNote>{general}</ErrorNote>
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus
        error={field('email')}
      />
      <Field
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        error={field('password')}
      />
      <label className="flex items-center gap-2 text-sm text-zinc-400">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-indigo-500" />
        Remember me
      </label>
      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending ? 'Logging in…' : 'Log in'}
      </Button>
    </form>
  )
}

function RegisterForm() {
  const register = useRegister()
  const [form, setForm] = useState({ display_name: '', email: '', password: '', password_confirmation: '' })
  const { field, general } = problem(register.error)

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    register.mutate(form)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorNote>{general}</ErrorNote>
      <Field
        label="Display name"
        value={form.display_name}
        onChange={set('display_name')}
        maxLength={32}
        required
        autoFocus
        error={field('display_name')}
      />
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={set('email')}
        required
        error={field('email')}
      />
      <Field
        label="Password"
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={set('password')}
        minLength={8}
        required
        error={field('password')}
      />
      <Field
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        value={form.password_confirmation}
        onChange={set('password_confirmation')}
        required
      />
      <AgreeToTerms />
      <Button type="submit" className="w-full" disabled={register.isPending}>
        {register.isPending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}

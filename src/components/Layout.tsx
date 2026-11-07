import { NavLink, Outlet } from 'react-router'
import type { User } from '../lib/auth'
import { useLogout } from '../lib/auth'
import { useRealtime, type ConnectionState } from '../lib/realtime-context'
import { Button, GuestBadge } from './ui'

const DOT: Record<ConnectionState, string> = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-400 animate-pulse',
  disconnected: 'bg-zinc-400',
  unavailable: 'bg-red-500',
}

export function Layout({ user }: { user: User }) {
  const logout = useLogout()
  const { state } = useRealtime()

  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      isActive
        ? 'bg-zinc-100 dark:bg-zinc-800'
        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
    }`

  const signOut = () => {
    if (user.is_guest && !confirm('Guest accounts are deleted on logout. Log out anyway?')) return
    logout.mutate()
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <span className="mr-4 font-bold">Chat</span>
          <nav className="flex gap-1">
            <NavLink to="/" end className={link}>
              Home
            </NavLink>
            <NavLink to="/profile" className={link}>
              Profile
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm" title={`Live connection: ${state}`}>
              <span className={`size-2 rounded-full ${DOT[state]}`} />
              <span className="font-medium">{user.display_name}</span>
              {user.is_guest && <GuestBadge />}
            </span>
            <Button variant="ghost" onClick={signOut} disabled={logout.isPending}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

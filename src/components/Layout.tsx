import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useMatch, useNavigate } from 'react-router'
import { ApiError } from '../lib/api'
import type { User } from '../lib/auth'
import { useLogout } from '../lib/auth'
import { useConversations, useOpenDm, type Dm, type Group } from '../lib/conversations'
import { nameOf, useFriends } from '../lib/friends'
import { useLiveUpdates } from '../lib/live'
import { NAV, useNavOpen } from '../lib/nav'
import { STATUS_DOT, STATUS_LABEL, useActivityReporter, useSetStatus, useStatusOf, type Preference, type Status } from '../lib/presence'
import { useRealtime, type ConnectionState } from '../lib/realtime-context'
import { Avatar, GroupIcon, StatusDot } from './Avatar'
import { Icon } from './icons'
import { GuestBadge } from './ui'

const DOT: Record<ConnectionState, string> = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-400 animate-pulse',
  disconnected: 'bg-zinc-400',
  unavailable: 'bg-red-500',
}

/**
 * Discord's three columns: a server rail, a channel sidebar and the main panel. Phones show
 * the rail and sidebar or the main panel, never both.
 */
export function Layout({ user }: { user: User }) {
  useLiveUpdates(user)
  useActivityReporter()
  const navOpen = useNavOpen()
  const conversations = useConversations()
  const friends = useFriends()
  const groupMatch = useMatch('/groups/:id/*')

  const all = conversations.data ?? []
  const dms = all.filter((c): c is Dm => c.type === 'dm')
  const groups = all.filter((c): c is Group => c.type === 'group').sort((a, b) => a.joined_at.localeCompare(b.joined_at))
  const currentGroup = groups.find((g) => String(g.id) === groupMatch?.params.id)

  const incoming = friends.data?.filter((f) => f.status === 'incoming').length ?? 0
  const dmUnread = dms.reduce((sum, c) => sum + c.unread_count, 0)
  const unread = all.reduce((sum, c) => sum + c.unread_count, 0)

  useEffect(() => {
    document.title = unread + incoming > 0 ? `(${unread + incoming}) Chat` : 'Chat'
  }, [unread, incoming])

  return (
    // Padded clear of a phone's notch and home bar when installed full screen.
    <div className="flex h-dvh overflow-hidden bg-main pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-zinc-100">
      <div data-testid="navigation" className={`${navOpen ? 'flex' : 'hidden'} min-w-0 flex-1 md:flex md:flex-none`}>
        <nav aria-label="Servers" className="flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-rail py-3">
          <RailItem to="/" label="Direct messages" active={!groupMatch} badge={dmUnread}>
            <span className="flex size-12 items-center justify-center bg-indigo-500 text-white">
              <Icon name="chat" className="size-7" />
            </span>
          </RailItem>
          <div className="h-0.5 w-8 shrink-0 rounded bg-side" />
          <ul aria-label="Groups" className="flex flex-col items-center gap-2">
            {groups.map((group) => (
              <li key={group.id}>
                <RailItem to={`/groups/${group.id}`} label={group.name} active={currentGroup?.id === group.id} badge={group.unread_count}>
                  <GroupIcon group={group} />
                </RailItem>
              </li>
            ))}
          </ul>
          <RailItem to="/groups/new" label="Create or join a group" active={groupMatch?.params.id === 'new'} page>
            <span className="flex size-12 items-center justify-center bg-side text-emerald-500 transition group-hover:bg-emerald-600 group-hover:text-white">
              <Icon name="plus" />
            </span>
          </RailItem>
          <RailItem to="/groups/explore" label="Explore public groups" active={groupMatch?.params.id === 'explore'} page>
            <span className="flex size-12 items-center justify-center bg-side text-emerald-500 transition group-hover:bg-emerald-600 group-hover:text-white">
              <Icon name="compass" />
            </span>
          </RailItem>
        </nav>

        <aside className="flex min-w-0 flex-1 flex-col bg-side md:w-60 md:flex-none">
          {currentGroup ? (
            <GroupSidebar group={currentGroup} />
          ) : (
            <>
              <div className="flex h-12 items-center border-b border-black/20 px-2.5 shadow-sm">
                <StartDm />
              </div>

              <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
                <SideLink to="/" end icon={<Icon name="users" className="size-6" />}>
                  <span className="flex-1">Friends</span>
                  {incoming > 0 && <Badge>{incoming}</Badge>}
                </SideLink>

                <h2 className="px-2 pt-4 pb-1 text-xs font-semibold tracking-wide text-zinc-400 uppercase">Direct messages</h2>
                <ul aria-label="Direct messages" className="space-y-0.5">
                  {dms.map((c) => (
                    <li key={c.id}>
                      <DmLink dm={c} />
                    </li>
                  ))}
                </ul>
                {conversations.isSuccess && dms.length === 0 && (
                  <p className="px-2 py-1 text-sm text-zinc-500">No conversations yet. Message a friend to start one.</p>
                )}
              </div>
            </>
          )}

          <UserPanel user={user} />
        </aside>
      </div>

      <main className={`${navOpen ? 'hidden' : 'flex'} min-w-0 flex-1 flex-col md:flex`}>
        <Outlet />
      </main>
    </div>
  )
}

/**
 * A rail icon: round until hovered or active, with Discord's white pill on the left. On a
 * phone it switches the sidebar and keeps it showing, unless it leads straight to a `page`.
 */
function RailItem({
  to,
  label,
  active,
  badge = 0,
  page,
  children,
}: {
  to: string
  label: string
  active: boolean
  badge?: number
  page?: boolean
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      state={page ? NAV.closed : NAV.open}
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
      className="group relative flex px-3"
    >
      <span
        className={`absolute top-1/2 left-0 w-1 -translate-y-1/2 rounded-r bg-white transition-all ${
          active ? 'h-10' : badge > 0 ? 'h-2' : 'h-0 group-hover:h-5'
        }`}
      />
      <span className={`overflow-hidden transition-all ${active ? 'rounded-xl' : 'rounded-3xl group-hover:rounded-xl'}`}>{children}</span>
      {badge > 0 && <Badge className="absolute right-2 -bottom-1 ring-4 ring-rail">{badge}</Badge>}
    </Link>
  )
}

function GroupSidebar({ group }: { group: Group }) {
  return (
    <>
      <Link
        to={`/groups/${group.id}/settings`}
        state={NAV.closed}
        className="flex h-12 items-center gap-2 border-b border-black/20 px-4 font-semibold shadow-sm hover:bg-hover/40"
      >
        <span className="flex-1 truncate">{group.name}</span>
        <Icon name="chevronDown" className="size-4 text-zinc-400" />
      </Link>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        <SideLink to={`/groups/${group.id}`} end icon={<Icon name="hashtag" className="size-5" />} bold={group.unread_count > 0}>
          <span className="flex-1">chat</span>
          {group.unread_count > 0 && <Badge>{group.unread_count}</Badge>}
        </SideLink>
        <SideLink to={`/groups/${group.id}/settings`} icon={<Icon name="cog" className="size-5" />}>
          <span className="flex-1">Settings</span>
        </SideLink>
        <p className="px-2 pt-4 text-xs text-zinc-500">
          {group.visibility === 'public' ? 'Public' : 'Private'} group · {group.member_count}{' '}
          {group.member_count === 1 ? 'member' : 'members'}
        </p>
      </div>
    </>
  )
}

function DmLink({ dm }: { dm: Dm }) {
  const status = useStatusOf(dm.user?.id)

  return (
    <SideLink to={`/dm/${dm.id}`} icon={<Avatar user={dm.user} size="sm" status={dm.user ? status : undefined} on="side" />} bold={dm.unread_count > 0}>
      <span className="flex-1 truncate">{nameOf(dm.user)}</span>
      {dm.unread_count > 0 && <Badge>{dm.unread_count}</Badge>}
    </SideLink>
  )
}

export function Badge({ children, className = '' }: { children: number; className?: string }) {
  return (
    <span className={`min-w-5 rounded-full bg-red-500 px-1.5 text-center text-xs leading-5 font-bold text-white ${className}`}>
      {children > 99 ? '99+' : children}
    </span>
  )
}

function SideLink({
  to,
  end,
  icon,
  bold,
  children,
}: {
  to: string
  end?: boolean
  icon: ReactNode
  bold?: boolean
  children: ReactNode
}) {
  return (
    <NavLink
      to={to}
      end={end}
      state={NAV.closed}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded px-2 py-1.5 text-[15px] transition ${
          isActive
            ? 'bg-hover text-white'
            : bold
              ? 'font-semibold text-white hover:bg-hover/60'
              : 'text-zinc-400 hover:bg-hover/60 hover:text-zinc-200'
        }`
      }
    >
      {icon}
      {children}
    </NavLink>
  )
}

/** "Find or start a conversation": anyone can be messaged by their ID. */
function StartDm() {
  const open = useOpenDm()
  const navigate = useNavigate()
  const [id, setId] = useState('')
  const error = open.error instanceof ApiError ? (open.error.field('id') ?? open.error.message) : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    open.mutate(id, {
      onSuccess: (conversation) => {
        setId('')
        navigate(`/dm/${conversation.id}`)
      },
    })
  }

  return (
    <form onSubmit={submit} className="relative w-full">
      <input
        aria-label="Message someone by ID"
        placeholder="Message someone by ID"
        value={id}
        onChange={(e) => {
          setId(e.target.value)
          open.reset()
        }}
        className="w-full rounded bg-rail px-2 py-1 text-sm text-zinc-200 max-md:text-base outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-indigo-500"
      />
      {error && (
        <p role="alert" className="absolute top-full left-0 z-10 mt-1 w-full rounded bg-rail px-2 py-1 text-xs text-red-400 shadow-lg">
          {error}
        </p>
      )}
    </form>
  )
}

const PREFERENCES: { value: Preference; note: string }[] = [
  { value: 'online', note: '' },
  { value: 'idle', note: 'Shows you as away.' },
  { value: 'dnd', note: 'Shows others you are busy.' },
  { value: 'invisible', note: "You'll look offline, but can still use everything." },
]

const PREFERENCE_DOT: Record<Preference, Status> = { online: 'online', idle: 'idle', dnd: 'dnd', invisible: 'offline' }

function UserPanel({ user }: { user: User }) {
  const logout = useLogout()
  const { state } = useRealtime()
  const setStatus = useSetStatus()
  const seen = useStatusOf(user.id)
  const [copied, setCopied] = useState(false)
  const [menu, setMenu] = useState(false)

  // What others see, once HMS has caught up; until then, what you picked.
  const shown: Status = user.status === 'invisible' ? 'offline' : seen !== 'offline' ? seen : PREFERENCE_DOT[user.status ?? 'online']

  const copyId = async () => {
    await navigator.clipboard?.writeText(user.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const signOut = () => {
    if (user.is_guest && !confirm('Guest accounts are deleted on logout. Log out anyway?')) return
    logout.mutate()
  }

  return (
    <div className="relative flex items-center gap-2 bg-rail/60 px-2 py-2">
      <button
        onClick={() => setMenu(!menu)}
        aria-label="Set status"
        aria-expanded={menu}
        title={`${STATUS_LABEL[user.status ?? 'online']} · live connection: ${state}`}
        className="relative shrink-0 rounded-full"
      >
        <Avatar user={user} size="sm" />
        {state === 'connected' ? (
          <StatusDot status={shown} on="rail" />
        ) : (
          <span className={`absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-[3px] border-rail ${DOT[state]}`} />
        )}
      </button>
      {menu && (
        <>
          <button aria-label="Close status menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
          <div role="menu" aria-label="Status" className="absolute bottom-full left-2 z-20 mb-2 w-64 rounded-lg bg-rail p-1.5 shadow-xl ring-1 ring-black/40">
            {PREFERENCES.map(({ value, note }) => (
              <button
                key={value}
                role="menuitemradio"
                aria-checked={(user.status ?? 'online') === value}
                onClick={() => setStatus.mutate(value, { onSuccess: () => setMenu(false) })}
                className="flex w-full items-start gap-3 rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-indigo-500 hover:text-white"
              >
                <span className={`mt-1 size-2.5 shrink-0 rounded-full ${STATUS_DOT[PREFERENCE_DOT[value]]}`} />
                <span>
                  <span className="block font-medium">{STATUS_LABEL[value]}</span>
                  {note && <span className="block text-xs opacity-75">{note}</span>}
                </span>
                {(user.status ?? 'online') === value && <Icon name="check" className="ml-auto size-4 shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
      <button onClick={copyId} title="Copy your ID" className="min-w-0 flex-1 text-left">
        <span data-testid="me" className="flex items-center gap-1 truncate text-sm font-semibold">
          {user.display_name}
          {user.is_guest && <GuestBadge />}
        </span>
        <span className="block truncate text-xs text-zinc-400">{copied ? 'Copied!' : `#${user.id}`}</span>
      </button>
      <NavLink to="/settings" state={NAV.closed} aria-label="Settings" title="Settings" className="rounded p-1.5 text-zinc-400 hover:bg-hover hover:text-zinc-200">
        <Icon name="cog" />
      </NavLink>
      <button
        onClick={signOut}
        disabled={logout.isPending}
        aria-label="Log out"
        title="Log out"
        className="rounded p-1.5 text-zinc-400 hover:bg-hover hover:text-zinc-200"
      >
        <Icon name="logout" />
      </button>
    </div>
  )
}

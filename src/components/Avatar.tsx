import type { PublicUser } from '../lib/friends'
import { STATUS_DOT, STATUS_LABEL, type Status } from '../lib/presence'

// Spelled out in full so Tailwind finds the classes.
const COLOURS = [
  'bg-indigo-500',
  'bg-emerald-600',
  'bg-rose-500',
  'bg-amber-600',
  'bg-sky-600',
  'bg-fuchsia-600',
  'bg-teal-600',
  'bg-orange-600',
]

const SIZES = { sm: 'size-8 text-sm', md: 'size-10 text-base' }

function colourFor(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return COLOURS[hash % COLOURS.length]
}

// The dot's border matches what it sits on, so it looks cut out of the avatar.
const DOT_BORDER = { rail: 'border-rail', side: 'border-side', main: 'border-main' }

/** A status dot on the avatar's corner. */
export function StatusDot({ status, on, className = 'size-3.5' }: { status: Status; on: keyof typeof DOT_BORDER; className?: string }) {
  return (
    <span
      aria-hidden
      data-status={status}
      title={STATUS_LABEL[status]}
      className={`absolute -right-0.5 -bottom-0.5 rounded-full border-[3px] ${DOT_BORDER[on]} ${STATUS_DOT[status]} ${className}`}
    />
  )
}

/**
 * The first letter of their name on a colour picked from their ID, so it stays the same
 * across renames. Give `status` (and what it sits `on`) for an online dot.
 */
export function Avatar({
  user,
  size = 'md',
  status,
  on = 'main',
}: {
  user: PublicUser | null
  size?: keyof typeof SIZES
  status?: Status
  on?: keyof typeof DOT_BORDER
}) {
  if (status) {
    return (
      <span className="relative shrink-0">
        <Avatar user={user} size={size} />
        <StatusDot status={status} on={on} className={size === 'sm' ? 'size-3.5' : 'size-4'} />
      </span>
    )
  }

  return (
    <span
      aria-hidden
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ${SIZES[size]} ${
        user ? colourFor(user.id) : 'bg-zinc-600'
      }`}
    >
      {user ? [...user.display_name.trim()][0]?.toUpperCase() : '?'}
    </span>
  )
}

const GROUP_SIZES = { sm: 'size-8 text-xs', md: 'size-12 text-base', lg: 'size-16 text-xl' }

/** Up to two initials from the group's name, on a colour that survives renames. */
export function GroupIcon({
  group,
  size = 'md',
  className = '',
}: {
  group: { id: number; name: string }
  size?: keyof typeof GROUP_SIZES
  className?: string
}) {
  const initials = group.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0]?.toUpperCase())
    .join('')

  return (
    <span
      aria-hidden
      className={`flex shrink-0 select-none items-center justify-center font-semibold text-white ${GROUP_SIZES[size]} ${colourFor(`group-${group.id}`)} ${className}`}
    >
      {initials}
    </span>
  )
}

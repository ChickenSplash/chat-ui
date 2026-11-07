import type { PublicUser } from '../lib/friends'

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

/** The first letter of their name on a colour picked from their ID, so it stays the same across renames. */
export function Avatar({ user, size = 'md' }: { user: PublicUser | null; size?: keyof typeof SIZES }) {
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

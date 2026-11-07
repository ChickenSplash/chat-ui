import { useNavigate } from 'react-router'
import { ApiError } from '../lib/api'
import type { Group } from '../lib/conversations'
import type { GroupPreview as Preview } from '../lib/groups'
import { GroupIcon } from './Avatar'

/** A group you might join: from Explore or an invite link. */
export function GroupPreview({
  group,
  join,
  joining,
  error,
}: {
  group: Preview
  join: (onJoined: (joined: Group) => void) => void
  joining: boolean
  error?: unknown
}) {
  const navigate = useNavigate()

  return (
    <div data-testid={`group-${group.id}`} className="flex items-center gap-4 rounded-lg bg-side p-4">
      <GroupIcon group={group} className="rounded-2xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{group.name}</p>
        {group.description && <p className="truncate text-sm text-zinc-400">{group.description}</p>}
        <p className="text-xs text-zinc-500">
          {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
          {group.visibility === 'private' && ' · private'}
        </p>
        {error instanceof ApiError && <p className="text-sm text-red-400">{error.field('group') ?? error.message}</p>}
      </div>
      {group.joined ? (
        <button
          onClick={() => navigate(`/groups/${group.id}`)}
          className="rounded bg-field px-4 py-1.5 text-sm font-medium text-white hover:bg-hover"
        >
          Open
        </button>
      ) : (
        <button
          onClick={() => join((joined) => navigate(`/groups/${joined.id}`))}
          disabled={joining}
          aria-label={`Join ${group.name}`}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Join
        </button>
      )}
    </div>
  )
}

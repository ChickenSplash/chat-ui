import { useDeferredValue, useState } from 'react'
import { GroupPreview } from '../components/GroupPreview'
import { Icon } from '../components/icons'
import { useBrowseGroups, useJoinGroup } from '../lib/groups'
import { NavButton } from '../components/NavButton'

/** Public groups, biggest first. */
export function Explore() {
  const [search, setSearch] = useState('')
  const groups = useBrowseGroups(useDeferredValue(search.trim()))
  const join = useJoinGroup()

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-4 shadow-sm">
        <NavButton />
        <Icon name="compass" className="size-6 text-zinc-400" />
        <h1 className="font-semibold">Explore public groups</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl space-y-3">
          <input
            aria-label="Search groups"
            placeholder="Search groups by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full rounded-lg bg-rail px-4 py-2.5 text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-indigo-500"
          />
          {groups.data?.length === 0 && (
            <p className="py-8 text-center text-zinc-500">
              {search.trim() ? 'No public groups match that name.' : 'No public groups yet. Why not start one?'}
            </p>
          )}
          {groups.data?.map((group) => (
            <GroupPreview
              key={group.id}
              group={group}
              joining={join.isPending && join.variables === group.id}
              error={join.variables === group.id ? join.error : undefined}
              join={(onJoined) => join.mutate(group.id, { onSuccess: onJoined })}
            />
          ))}
        </div>
      </div>
    </>
  )
}

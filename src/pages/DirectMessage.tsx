import { Navigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Chat } from '../components/Chat'
import { GuestBadge } from '../components/ui'
import { ApiError } from '../lib/api'
import type { User } from '../lib/auth'
import { useConversation } from '../lib/conversations'
import { nameOf } from '../lib/friends'

export function DirectMessage({ user }: { user: User }) {
  const id = Number(useParams().id)
  const conversation = useConversation(id)
  const dm = conversation.data

  if (conversation.error instanceof ApiError && conversation.error.status === 404) return <Navigate to="/" replace />
  if (!dm) return null
  if (dm.type !== 'dm') return <Navigate to={`/groups/${dm.id}`} replace />

  const other = dm.user

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-4 shadow-sm">
        <Avatar user={other} size="sm" />
        <h1 className="font-semibold">{nameOf(other)}</h1>
        {other?.is_guest && <GuestBadge />}
        {other && <span className="text-sm text-zinc-500">#{other.id}</span>}
      </header>

      <Chat
        key={dm.id}
        me={user}
        conversation={dm}
        placeholder={`Message @${nameOf(other)}`}
        disabledReason={!other ? 'This user no longer exists.' : dm.blocked ? "You can't message this user." : undefined}
        canDelete={(message) => message.author?.id === user.id}
        intro={
          <>
            <Avatar user={other} />
            <h2 className="mt-2 text-2xl font-bold">{nameOf(other)}</h2>
            <p className="text-zinc-400">
              This is the beginning of your direct message history with <strong>{nameOf(other)}</strong>.
            </p>
          </>
        }
      />
    </>
  )
}

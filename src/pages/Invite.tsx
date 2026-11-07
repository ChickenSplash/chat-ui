import { Link, useParams } from 'react-router'
import { GroupPreview } from '../components/GroupPreview'
import { NavButton } from '../components/NavButton'
import { useAcceptInvite, useInvite } from '../lib/groups'

/** Where an invite link lands: what the group is, and a button to join it. */
export function Invite() {
  const code = useParams().code ?? ''
  const invite = useInvite(code)
  const accept = useAcceptInvite()

  return (
    <div className="relative flex flex-1 items-center justify-center px-6">
      <div className="absolute top-3 left-4">
        <NavButton />
      </div>
      <div className="w-full max-w-md space-y-3 text-center">
        <h1 className="text-xl font-semibold">You've been invited to join a group</h1>
        {invite.isError && (
          <>
            <p className="text-zinc-400">This invite link is invalid or has been reset.</p>
            <Link to="/" className="text-sky-400 hover:underline">
              Back to your messages
            </Link>
          </>
        )}
        {invite.data && (
          <div className="text-left">
            <GroupPreview
              group={invite.data}
              joining={accept.isPending}
              error={accept.error}
              join={(onJoined) => accept.mutate(code, { onSuccess: onJoined })}
            />
          </div>
        )}
      </div>
    </div>
  )
}

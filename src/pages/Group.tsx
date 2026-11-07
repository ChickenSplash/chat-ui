import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Avatar, GroupIcon } from '../components/Avatar'
import { NavButton } from '../components/NavButton'
import { Chat } from '../components/Chat'
import { Icon } from '../components/icons'
import { GuestBadge } from '../components/ui'
import { ApiError } from '../lib/api'
import type { User } from '../lib/auth'
import { useOpenDm, type Group as GroupData, type Role } from '../lib/conversations'
import { useBlocks } from '../lib/friends'
import {
  inviteUrl,
  outranks,
  RANK,
  ROLE_LABEL,
  useBan,
  useKick,
  useMembers,
  useSetRole,
  useGroupPage,
  useTransferGroup,
  type Member,
} from '../lib/groups'
import { usePresence } from '../lib/presence'

export function Group({ user }: { user: User }) {
  const { group, lost } = useGroupPage()
  const members = useMembers(group?.id ?? 0, !!group)
  const blocks = useBlocks()
  // On a phone the member list covers the chat, so it starts closed there.
  const [showMembers, setShowMembers] = useState(() => matchMedia('(min-width: 768px)').matches)
  const [copied, setCopied] = useState(false)

  // Kicked, banned, left in another tab or the group was deleted.
  if (lost) return <Navigate to="/" replace />
  if (!group) return null

  const ranks = new Map(members.data?.map((m) => [m.user.id, m.role]))
  const blocked = new Set(blocks.data?.map((u) => u.id))

  const copyInvite = async () => {
    await navigator.clipboard?.writeText(inviteUrl(group.invite_code))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-4 shadow-sm">
        <NavButton />
        <Icon name="hashtag" className="size-5 text-zinc-500" />
        <h1 className="font-semibold">{group.name}</h1>
        {group.description && (
          <>
            <div className="mx-2 h-6 w-px bg-zinc-600" />
            <p className="min-w-0 flex-1 truncate text-sm text-zinc-400">{group.description}</p>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <HeaderButton label={copied ? 'Invite link copied' : 'Copy invite link'} icon="link" onClick={copyInvite} />
          <HeaderButton
            label={showMembers ? 'Hide member list' : 'Show member list'}
            icon="users"
            active={showMembers}
            onClick={() => setShowMembers(!showMembers)}
          />
          <Link
            to={`/groups/${group.id}/settings`}
            aria-label="Group settings"
            title="Group settings"
            className="rounded p-1.5 text-zinc-400 hover:text-zinc-200"
          >
            <Icon name="cog" />
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Chat
          key={group.id}
          me={user}
          conversation={group}
          placeholder={`Message ${group.name}`}
          hiddenAuthors={blocked}
          canDelete={(message) =>
            message.author?.id === user.id ||
            (RANK[group.role] >= RANK.mod && outranks(group.role, message.author ? ranks.get(message.author.id) : undefined))
          }
          intro={
            <>
              <GroupIcon group={group} size="lg" className="rounded-full" />
              <h2 className="mt-2 text-3xl font-bold">Welcome to {group.name}</h2>
              <p className="text-zinc-400">This is the beginning of this group.</p>
            </>
          }
        />
        {showMembers && (
          <MemberList me={user} group={group} members={members.data ?? []} onClose={() => setShowMembers(false)} />
        )}
      </div>
    </>
  )
}

function HeaderButton({ label, icon, active, onClick }: { label: string; icon: 'link' | 'users'; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`rounded p-1.5 hover:text-zinc-200 ${active ? 'text-zinc-100' : 'text-zinc-400'}`}
    >
      <Icon name={icon} />
    </button>
  )
}

const ROLE_ORDER: Role[] = ['owner', 'admin', 'mod', 'member']

/** Beside the chat on a wide screen; on a phone, a panel over it from the right. */
function MemberList({ me, group, members, onClose }: { me: User; group: GroupData; members: Member[]; onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const presence = usePresence().data ?? {}

  return (
    <>
      <button aria-label="Close member list" onClick={onClose} className="fixed inset-0 z-20 bg-black/60 md:hidden" />
      <aside
        aria-label="Members"
        className="w-60 shrink-0 overflow-y-auto bg-side px-2 py-4 max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-30 max-md:w-72 max-md:shadow-2xl"
      >
        {ROLE_ORDER.map((role) => {
          const list = members.filter((m) => m.role === role)
          if (list.length === 0) return null

          return (
            <section key={role} className="mb-4">
              <h2 className="px-2 pb-1 text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                {role === 'member' ? 'Members' : `${ROLE_LABEL[role]}${role === 'owner' ? '' : 's'}`} · {list.length}
              </h2>
              <ul>
                {list.map((member) => (
                  <li key={member.user.id}>
                    <button
                      onClick={() => setOpen(open === member.user.id ? null : member.user.id)}
                      aria-expanded={open === member.user.id}
                      className={`flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-zinc-300 hover:bg-hover/60 hover:text-zinc-100 hover:opacity-100 ${
                        presence[member.user.id] ? '' : 'opacity-50'
                      }`}
                    >
                      <Avatar user={member.user} size="sm" status={presence[member.user.id] ?? 'offline'} on="side" />
                      <span className="min-w-0 flex-1 truncate">{member.user.display_name}</span>
                      {member.user.is_guest && <GuestBadge />}
                    </button>
                    {open === member.user.id && (
                      <MemberActions me={me} group={group} member={member} onDone={() => setOpen(null)} />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </aside>
    </>
  )
}

/** What you may do to someone, which depends on both your ranks. */
function MemberActions({ me, group, member, onDone }: { me: User; group: GroupData; member: Member; onDone: () => void }) {
  const navigate = useNavigate()
  const openDm = useOpenDm()
  const setRole = useSetRole(group.id)
  const kick = useKick(group.id)
  const ban = useBan(group.id)
  const transfer = useTransferGroup(group.id)
  const { user } = member
  const self = user.id === me.id
  const above = outranks(group.role, member.role)
  const error = [setRole.error, kick.error, ban.error, transfer.error].find(Boolean)

  const done = { onSuccess: onDone }

  return (
    <div className="mx-2 mb-2 space-y-0.5 rounded bg-rail p-1.5 text-sm">
      <p className="px-2 py-1 text-xs text-zinc-500">
        {ROLE_LABEL[member.role]} · #{user.id}
      </p>
      {!self && (
        <MenuItem onClick={() => openDm.mutate(user.id, { onSuccess: (dm) => navigate(`/dm/${dm.id}`) })}>Message</MenuItem>
      )}
      {!self &&
        above &&
        RANK[group.role] >= RANK.admin &&
        (['admin', 'mod', 'member'] as const)
          .filter((role) => role !== member.role)
          .map((role) => (
            <MenuItem key={role} onClick={() => setRole.mutate({ userId: user.id, role }, done)}>
              {role === 'member' ? 'Make a regular member' : `Make ${role === 'admin' ? 'an admin' : 'a mod'}`}
            </MenuItem>
          ))}
      {!self && group.role === 'owner' && (
        <MenuItem
          onClick={() =>
            confirm(`Hand ${group.name} over to ${user.display_name}? You will become an admin.`) &&
            transfer.mutate(user.id, done)
          }
        >
          Transfer ownership
        </MenuItem>
      )}
      {!self && above && RANK[group.role] >= RANK.mod && (
        <MenuItem danger onClick={() => confirm(`Kick ${user.display_name} from ${group.name}?`) && kick.mutate(user.id, done)}>
          Kick {user.display_name}
        </MenuItem>
      )}
      {!self && above && RANK[group.role] >= RANK.admin && (
        <MenuItem
          danger
          onClick={() =>
            confirm(`Ban ${user.display_name}? They won't be able to rejoin until unbanned.`) && ban.mutate(user.id, done)
          }
        >
          Ban {user.display_name}
        </MenuItem>
      )}
      {error instanceof ApiError && <p className="px-2 py-1 text-xs text-red-400">{error.message}</p>}
    </div>
  )
}

function MenuItem({ danger, onClick, children }: { danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded px-2 py-1 text-left hover:bg-indigo-500 hover:text-white ${danger ? 'text-red-400' : 'text-zinc-300'}`}
    >
      {children}
    </button>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { api, ApiError } from './api'
import { CONVERSATIONS, useConversation, type Group, type Role, type SystemEvent } from './conversations'
import type { PublicUser } from './friends'

export type GroupPreview = {
  id: number
  name: string
  description: string | null
  visibility: 'public' | 'private'
  member_count: number
  joined: boolean
}

export type Member = { user: PublicUser; role: Role; joined_at: string }

export type GroupDetails = { name?: string; description?: string | null; visibility?: 'public' | 'private' }

export const RANK: Record<Role, number> = { member: 0, mod: 1, admin: 2, owner: 3 }

/** You can only act on people ranked below you; someone who has left counts as a member. */
export const outranks = (mine: Role, theirs: Role | undefined) => RANK[mine] > RANK[theirs ?? 'member']

export const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', admin: 'Admin', mod: 'Mod', member: 'Member' }

export const GROUPS = ['groups']
export const membersKey = (id: number) => [...GROUPS, id, 'members']
export const bansKey = (id: number) => [...GROUPS, id, 'bans']

export const inviteUrl = (code: string) => `${location.origin}/invite/${code}`

/** Accepts a full invite link or just its code. */
export const inviteCodeFrom = (input: string) => input.trim().replace(/\/+$/, '').split('/').pop() ?? ''

/** The group in the URL, and whether you've lost it (kicked, banned, left elsewhere or deleted). */
export function useGroupPage() {
  const id = Number(useParams().id)
  const conversation = useConversation(id)
  const lost = conversation.error instanceof ApiError && conversation.error.status === 404
  const group = conversation.data?.type === 'group' ? conversation.data : undefined

  return { id, group, lost }
}

export const useBrowseGroups = (search: string) =>
  useQuery({
    queryKey: [...GROUPS, 'browse', search],
    queryFn: () => api<GroupPreview[]>('GET', `/api/groups?q=${encodeURIComponent(search)}`),
    placeholderData: (previous) => previous,
  })

export const useInvite = (code: string) =>
  useQuery({
    queryKey: [...GROUPS, 'invite', code],
    queryFn: () => api<GroupPreview>('GET', `/api/invites/${encodeURIComponent(code)}`),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 3,
  })

export const useMembers = (id: number, enabled = true) =>
  useQuery({ queryKey: membersKey(id), queryFn: () => api<Member[]>('GET', `/api/groups/${id}/members`), enabled })

export const useBans = (id: number, enabled: boolean) =>
  useQuery({ queryKey: bansKey(id), queryFn: () => api<PublicUser[]>('GET', `/api/groups/${id}/bans`), enabled })

/** Every group change also arrives over the WebSocket; refetching here just makes it instant. */
function useGroupMutation<T, R = void>(fn: (input: T) => Promise<R>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS })
      queryClient.invalidateQueries({ queryKey: GROUPS })
    },
  })
}

export const useCreateGroup = () =>
  useGroupMutation((details: Required<GroupDetails>) => api<Group>('POST', '/api/groups', details))

export const useJoinGroup = () => useGroupMutation((id: number) => api<Group>('POST', `/api/groups/${id}/join`))

export const useAcceptInvite = () =>
  useGroupMutation((code: string) => api<Group>('POST', `/api/invites/${encodeURIComponent(code)}`))

export const useUpdateGroup = (id: number) =>
  useGroupMutation((details: GroupDetails) => api<Group>('PATCH', `/api/groups/${id}`, details))

export const useResetInvite = (id: number) => useGroupMutation(() => api<Group>('POST', `/api/groups/${id}/invite`))

export const useLeaveGroup = (id: number) => useGroupMutation(() => api('POST', `/api/groups/${id}/leave`))

export const useDeleteGroup = (id: number) => useGroupMutation(() => api('DELETE', `/api/groups/${id}`))

export const useTransferGroup = (id: number) =>
  useGroupMutation((userId: string) => api('POST', `/api/groups/${id}/transfer`, { id: userId }))

export const useSetRole = (id: number) =>
  useGroupMutation(({ userId, role }: { userId: string; role: Role }) =>
    api('PUT', `/api/groups/${id}/members/${userId}`, { role }),
  )

export const useKick = (id: number) => useGroupMutation((userId: string) => api('DELETE', `/api/groups/${id}/members/${userId}`))

export const useBan = (id: number) => useGroupMutation((userId: string) => api('PUT', `/api/groups/${id}/bans/${userId}`))

export const useUnban = (id: number) => useGroupMutation((userId: string) => api('DELETE', `/api/groups/${id}/bans/${userId}`))

/** The grey line shown for a system message. */
export function describeEvent({ event, user, by, role }: SystemEvent): string {
  const who = user.display_name
  const actor = by?.display_name

  switch (event) {
    case 'joined':
      return `${who} joined the group.`
    case 'left':
      return `${who} left the group.`
    case 'kicked':
      return `${actor ?? 'Someone'} kicked ${who}.`
    case 'banned':
      return `${actor ?? 'Someone'} banned ${who}.`
    case 'role':
      return role === 'member'
        ? `${actor ?? 'Someone'} made ${who} a regular member.`
        : `${actor ?? 'Someone'} made ${who} ${role === 'admin' ? 'an admin' : 'a mod'}.`
    case 'owner':
      return actor ? `${actor} handed ownership to ${who}.` : `${who} is now the owner.`
  }
}

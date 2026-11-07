import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

export type PublicUser = {
  id: string
  display_name: string
  is_guest: boolean
}

/** A deleted user (a guest who logged out) has no name left to show. */
export const nameOf = (user: PublicUser | null) => user?.display_name ?? 'Deleted user'

export type FriendStatus = 'friend' | 'incoming' | 'outgoing'

export type FriendEntry = {
  user: PublicUser
  status: FriendStatus
  since: string
}

export const FRIENDS = ['friends']
export const BLOCKS = ['blocks']

export const useFriends = () =>
  useQuery({ queryKey: FRIENDS, queryFn: () => api<FriendEntry[]>('GET', '/api/friends') })

export const useBlocks = () =>
  useQuery({ queryKey: BLOCKS, queryFn: () => api<PublicUser[]>('GET', '/api/blocks') })

/** Every friend change also arrives over the WebSocket; refetching here just makes it instant. */
function useFriendMutation<T, R = void>(fn: (input: T) => Promise<R>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FRIENDS })
      queryClient.invalidateQueries({ queryKey: BLOCKS })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export const useSendFriendRequest = () =>
  useFriendMutation((id: string) => api<FriendEntry>('POST', '/api/friends', { id }))

export const useAcceptFriend = () =>
  useFriendMutation((id: string) => api<FriendEntry>('POST', `/api/friends/${id}/accept`))

/** Decline, cancel or unfriend. */
export const useRemoveFriend = () => useFriendMutation((id: string) => api('DELETE', `/api/friends/${id}`))

export const useBlock = () => useFriendMutation((id: string) => api('PUT', `/api/blocks/${id}`))

export const useUnblock = () => useFriendMutation((id: string) => api('DELETE', `/api/blocks/${id}`))

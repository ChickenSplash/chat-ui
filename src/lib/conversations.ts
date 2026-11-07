import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { useMemo, useSyncExternalStore } from 'react'
import { api, ApiError } from './api'
import type { PublicUser } from './friends'

export type SystemEvent = {
  event: 'joined' | 'left' | 'kicked' | 'banned' | 'role' | 'owner'
  user: PublicUser
  by?: PublicUser
  role?: string
}

export type Message = {
  id: number
  conversation_id: number
  /** System messages ("Bob joined") have no author or body; meta says what happened. */
  type: 'text' | 'system'
  author: PublicUser | null
  body: string
  meta: SystemEvent | null
  nonce: string | null
  created_at: string
  edited_at: string | null
  reply_to: ReplyPreview | null
}

export type ReplyPreview = { id: number; author: PublicUser | null; body: string | null; deleted: boolean }

export type Role = 'owner' | 'admin' | 'mod' | 'member'

type Common = {
  id: number
  last_message: Message | null
  last_read_message_id: number | null
  unread_count: number
}

export type Dm = Common & {
  type: 'dm'
  /** The other person; null once they have been deleted. */
  user: PublicUser | null
  blocked: boolean
}

export type Group = Common & {
  type: 'group'
  name: string
  description: string | null
  visibility: 'public' | 'private'
  invite_code: string
  role: Role
  member_count: number
  joined_at: string
}

export type Conversation = Dm | Group

type Page = { data: Message[]; has_more: boolean }

export const CONVERSATIONS = ['conversations']

export const useConversations = () =>
  useQuery({ queryKey: CONVERSATIONS, queryFn: () => api<Conversation[]>('GET', '/api/conversations') })

export const useConversation = (id: number) =>
  useQuery({
    queryKey: [...CONVERSATIONS, id],
    queryFn: () => api<Conversation>('GET', `/api/conversations/${id}`),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 3,
  })

export function useOpenDm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api<Conversation>('POST', '/api/dms', { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONVERSATIONS }),
  })
}

const messagesKey = (conversationId: number) => ['messages', conversationId]

/**
 * Pages run newest first (page 0 holds the latest 50). Live messages are written straight
 * into the cache, so it never needs refetching while the WebSocket is up.
 */
export function useMessages(conversationId: number) {
  const query = useInfiniteQuery({
    queryKey: messagesKey(conversationId),
    queryFn: ({ pageParam }) =>
      api<Page>('GET', `/api/conversations/${conversationId}/messages${pageParam ? `?before=${pageParam}` : ''}`),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.data[0]?.id : undefined),
    staleTime: Infinity,
  })

  const messages = useMemo(
    () => (query.data ? [...query.data.pages].reverse().flatMap((page) => page.data) : []),
    [query.data],
  )

  return { ...query, messages }
}

export function addMessage(queryClient: QueryClient, message: Message) {
  queryClient.setQueryData<InfiniteData<Page>>(messagesKey(message.conversation_id), (data) => {
    if (!data || data.pages.some((page) => page.data.some((m) => m.id === message.id))) return data
    const [latest, ...older] = data.pages
    const merged = [...latest.data, message].sort((a, b) => a.id - b.id)
    return { ...data, pages: [{ ...latest, data: merged }, ...older] }
  })
}

export function removeMessage(queryClient: QueryClient, conversationId: number, id: number) {
  queryClient.setQueryData<InfiniteData<Page>>(messagesKey(conversationId), (data) =>
    data && {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        data: page.data.filter((m) => m.id !== id).map((m) => m.reply_to?.id === id
          ? { ...m, reply_to: { id, author: null, body: null, deleted: true } } : m),
      })),
    },
  )
}

/** Replace in place, including previews of replies whose original isn't in the loaded pages. */
export function updateMessage(queryClient: QueryClient, message: Message) {
  queryClient.setQueryData<InfiniteData<Page>>(messagesKey(message.conversation_id), (data) =>
    data && {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        data: page.data.map((m) => {
          if (m.id === message.id) return message
          if (m.reply_to?.id !== message.id) return m
          return {
            ...m,
            reply_to: { id: message.id, author: message.author, body: [...message.body].slice(0, 200).join(''), deleted: false },
          }
        }),
      })),
    },
  )
}

export function useEditMessage(conversationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api<Message>('PATCH', `/api/conversations/${conversationId}/messages/${id}`, { body }),
    onSuccess: (message) => {
      updateMessage(queryClient, message)
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS })
    },
  })
}

// Messages on their way to the server. Shown greyed out until HMS confirms them, at which
// point the saved copy (carrying the same nonce) takes over.

export type PendingMessage = {
  nonce: string
  conversationId: number
  body: string
  createdAt: string
  status: 'sending' | 'failed'
  error?: string
  replyTo?: ReplyPreview | null
}

let pending: PendingMessage[] = []
const listeners = new Set<() => void>()

function setPending(next: PendingMessage[]) {
  pending = next
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePending(conversationId: number) {
  const all = useSyncExternalStore(subscribe, () => pending)
  return useMemo(() => all.filter((p) => p.conversationId === conversationId), [all, conversationId])
}

const newNonce = () =>
  typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export async function sendMessage(queryClient: QueryClient, conversationId: number, body: string, nonce = newNonce(), replyTo?: ReplyPreview | null) {
  const existing = pending.find((p) => p.nonce === nonce)
  const entry: PendingMessage = existing
    ? { ...existing, status: 'sending', error: undefined }
    : { nonce, conversationId, body, replyTo, createdAt: new Date().toISOString(), status: 'sending' }
  setPending(existing ? pending.map((p) => (p.nonce === nonce ? entry : p)) : [...pending, entry])

  try {
    const saved = await api<Message>('POST', `/api/conversations/${conversationId}/messages`, {
      body,
      nonce,
      reply_to_message_id: entry.replyTo?.id ?? null,
    })
    addMessage(queryClient, saved)
    setPending(pending.filter((p) => p.nonce !== nonce))
    queryClient.invalidateQueries({ queryKey: CONVERSATIONS })
  } catch (error) {
    const reason =
      error instanceof ApiError && error.status === 429
        ? 'Slow down a little.'
        : error instanceof ApiError && error.status < 500
          ? error.message
          : 'Failed to send.'
    setPending(pending.map((p) => (p.nonce === nonce ? { ...p, status: 'failed', error: reason } : p)))
  }
}

export function discardPending(nonce: string) {
  setPending(pending.filter((p) => p.nonce !== nonce))
}

export function useDeleteMessage(conversationId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api('DELETE', `/api/conversations/${conversationId}/messages/${id}`),
    onSuccess: (_, id) => {
      removeMessage(queryClient, conversationId, id)
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS })
    },
  })
}

export async function markRead(queryClient: QueryClient, conversationId: number, messageId: number) {
  await api('POST', `/api/conversations/${conversationId}/read`, { message_id: messageId })
  queryClient.invalidateQueries({ queryKey: CONVERSATIONS })
}

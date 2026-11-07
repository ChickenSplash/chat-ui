import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Navigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/icons'
import { Linkified } from '../components/Linkified'
import { GuestBadge } from '../components/ui'
import { ApiError } from '../lib/api'
import type { User } from '../lib/auth'
import {
  discardPending,
  markRead,
  sendMessage,
  useConversation,
  useDeleteMessage,
  useMessages,
  usePending,
  type Conversation,
  type Message,
  type PendingMessage,
} from '../lib/conversations'
import { nameOf, type PublicUser } from '../lib/friends'

const MAX_LENGTH = 2000
// Messages from the same person this close together share one header, as in Discord.
const GROUP_WINDOW_MS = 7 * 60 * 1000

type Row =
  | { kind: 'saved'; message: Message; author: PublicUser | null; at: string; grouped: boolean }
  | { kind: 'pending'; message: PendingMessage; author: PublicUser; at: string; grouped: boolean }

export function DirectMessage({ user }: { user: User }) {
  const id = Number(useParams().id)
  const conversation = useConversation(id)

  if (conversation.error instanceof ApiError && conversation.error.status === 404) return <Navigate to="/" replace />
  if (!conversation.data) return null

  // Keyed, so switching DMs starts with a fresh composer and scroll position.
  return <Chat key={id} me={user} conversation={conversation.data} />
}

function Chat({ me, conversation }: { me: User; conversation: Conversation }) {
  const queryClient = useQueryClient()
  const { messages, fetchNextPage, hasNextPage, isFetchingNextPage, isSuccess } = useMessages(conversation.id)
  const pending = usePending(conversation.id)
  const other = conversation.user
  const canSend = !!other && !conversation.blocked

  // Once the saved copy of a pending message arrives (HTTP reply or WebSocket, whichever is
  // first), the grey copy disappears.
  const saved = new Set(messages.map((m) => m.nonce).filter(Boolean))
  const rows = toRows(messages, pending.filter((p) => !saved.has(p.nonce)), me)

  useMarkRead(conversation, messages.at(-1)?.id)

  const olderSentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const target = olderSentinel.current
    if (!target || !hasNextPage) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage()
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-4 shadow-sm">
        <Avatar user={other} size="sm" />
        <h1 className="font-semibold">{nameOf(other)}</h1>
        {other?.is_guest && <GuestBadge />}
        {other && <span className="text-sm text-zinc-500">#{other.id}</span>}
      </header>

      {/* The scroll box is column-reverse around a single child, so it stays pinned to the
          newest message and loading older ones above does not make it jump. */}
      <div data-testid="messages" className="flex flex-1 flex-col-reverse overflow-y-auto">
        <div className="pb-4">
          <div ref={olderSentinel} className="min-h-px">
            {isFetchingNextPage && <p className="py-2 text-center text-sm text-zinc-500">Loading older messages…</p>}
          </div>

          {isSuccess && !hasNextPage && (
            <div className="mx-4 mb-4 pt-8">
              <Avatar user={other} />
              <h2 className="mt-2 text-2xl font-bold">{nameOf(other)}</h2>
              <p className="text-zinc-400">
                This is the beginning of your direct message history with <strong>{nameOf(other)}</strong>.
              </p>
            </div>
          )}

          {rows.map((row) =>
            row.kind === 'saved' ? (
              <SavedRow key={row.message.id} row={row} mine={row.message.author?.id === me.id} conversationId={conversation.id} />
            ) : (
              <PendingRow key={row.message.nonce} row={row} />
            ),
          )}
        </div>
      </div>

      <Composer
        disabledReason={!other ? 'This user no longer exists.' : conversation.blocked ? "You can't message this user." : undefined}
        placeholder={`Message @${nameOf(other)}`}
        onSend={(body) => canSend && sendMessage(queryClient, conversation.id, body)}
      />
    </>
  )
}

function toRows(messages: Message[], pending: PendingMessage[], me: User): Row[] {
  const rows: Row[] = [
    ...messages.map((message) => ({ kind: 'saved' as const, message, author: message.author, at: message.created_at, grouped: false })),
    ...pending.map((message) => ({ kind: 'pending' as const, message, author: me as PublicUser, at: message.createdAt, grouped: false })),
  ]

  rows.forEach((row, i) => {
    const prev = rows[i - 1]
    row.grouped =
      !!prev &&
      !!row.author &&
      prev.author?.id === row.author.id &&
      new Date(row.at).getTime() - new Date(prev.at).getTime() < GROUP_WINDOW_MS
  })

  return rows
}

/** Read up to the newest message whenever it changes and the tab is visible. */
function useMarkRead(conversation: { id: number; last_read_message_id: number | null }, newest: number | undefined) {
  const queryClient = useQueryClient()
  const marked = useRef(0)

  useEffect(() => {
    const mark = () => {
      if (!newest || document.visibilityState !== 'visible') return
      if (newest <= (conversation.last_read_message_id ?? 0) || newest <= marked.current) return
      marked.current = newest
      markRead(queryClient, conversation.id, newest).catch(() => (marked.current = 0))
    }

    mark()
    document.addEventListener('visibilitychange', mark)
    return () => document.removeEventListener('visibilitychange', mark)
  }, [newest, conversation.id, conversation.last_read_message_id, queryClient])
}

function formatTime(iso: string, withDate: boolean) {
  const date = new Date(iso)
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (!withDate) return time
  const today = new Date().toDateString() === date.toDateString()
  return today ? `Today at ${time}` : `${date.toLocaleDateString()} ${time}`
}

function RowShell({
  row,
  testId,
  children,
  tools,
}: {
  row: Row
  testId: string
  children: ReactNode
  tools?: ReactNode
}) {
  return (
    <div
      data-testid={testId}
      className={`group relative flex gap-4 px-4 hover:bg-black/10 ${row.grouped ? 'py-0.5' : 'mt-4 py-0.5'}`}
    >
      <div className="w-10 shrink-0">
        {row.grouped ? (
          <span className="invisible block text-right text-[10px] leading-6 whitespace-nowrap text-zinc-500 group-hover:visible">
            {formatTime(row.at, false)}
          </span>
        ) : (
          <Avatar user={row.author} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!row.grouped && (
          <p className="flex items-baseline gap-2">
            <span className="font-medium text-white">{nameOf(row.author)}</span>
            <span className="text-xs text-zinc-500">{formatTime(row.at, true)}</span>
          </p>
        )}
        {children}
      </div>
      {tools && <div className="absolute -top-3 right-4 hidden rounded bg-side shadow ring-1 ring-black/20 group-hover:flex">{tools}</div>}
    </div>
  )
}

function SavedRow({ row, mine, conversationId }: { row: Extract<Row, { kind: 'saved' }>; mine: boolean; conversationId: number }) {
  const remove = useDeleteMessage(conversationId)

  return (
    <RowShell
      row={row}
      testId="message"
      tools={
        mine && (
          <button
            aria-label="Delete message"
            title="Delete message"
            onClick={() => confirm('Delete this message?') && remove.mutate(row.message.id)}
            className="p-1.5 text-zinc-400 hover:text-red-400"
          >
            <Icon name="trash" className="size-4" />
          </button>
        )
      }
    >
      <p className="break-words whitespace-pre-wrap text-zinc-100">
        <Linkified text={row.message.body} />
      </p>
    </RowShell>
  )
}

function PendingRow({ row }: { row: Extract<Row, { kind: 'pending' }> }) {
  const queryClient = useQueryClient()
  const { message } = row
  const failed = message.status === 'failed'

  return (
    <RowShell row={row} testId={failed ? 'message-failed' : 'message-pending'}>
      <p className={`break-words whitespace-pre-wrap ${failed ? 'text-red-400' : 'text-zinc-500'}`}>{message.body}</p>
      {failed && (
        <p className="text-xs text-red-400">
          {message.error}{' '}
          <button
            className="font-medium underline hover:text-red-300"
            onClick={() => sendMessage(queryClient, message.conversationId, message.body, message.nonce)}
          >
            Retry
          </button>{' '}
          ·{' '}
          <button className="font-medium underline hover:text-red-300" onClick={() => discardPending(message.nonce)}>
            Discard
          </button>
        </p>
      )}
    </RowShell>
  )
}

function Composer({
  placeholder,
  disabledReason,
  onSend,
}: {
  placeholder: string
  disabledReason?: string
  onSend: (body: string) => void
}) {
  const [body, setBody] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)

  // Grow with the text, up to about half the screen.
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight / 2)}px`
  }, [body])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!body.trim()) return
    onSend(body.trim())
    setBody('')
  }

  return (
    <div className="shrink-0 px-4 pb-6">
      {disabledReason ? (
        <p className="rounded-lg bg-field px-4 py-3 text-sm text-zinc-400">{disabledReason}</p>
      ) : (
        <div className="rounded-lg bg-field px-4 py-2.5">
          <textarea
            ref={input}
            rows={1}
            value={body}
            maxLength={MAX_LENGTH}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label={placeholder}
            autoFocus
            className="block w-full resize-none bg-transparent text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          {body.length > MAX_LENGTH - 200 && (
            <p className="text-right text-xs text-zinc-400">{MAX_LENGTH - body.length} characters left</p>
          )}
        </div>
      )}
    </div>
  )
}

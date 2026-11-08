import { useQueryClient } from '@tanstack/react-query'
import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { User } from '../lib/auth'
import { useConfirm } from '../lib/confirm'
import {
  discardPending,
  markRead,
  sendMessage,
  useConversations,
  useDeleteMessage,
  useEditMessage,
  useMessages,
  usePending,
  type Conversation,
  type Message,
  type PendingMessage,
  type ReplyPreview,
} from '../lib/conversations'
import { nameOf, type PublicUser } from '../lib/friends'
import { describeEvent } from '../lib/groups'
import { describeTyping, resetTyping, sendTyping, useTyping } from '../lib/typing'
import { Avatar } from './Avatar'
import { Icon } from './icons'
import { Linkified } from './Linkified'

const MAX_LENGTH = 2000
// Messages from the same person this close together share one header, as in Discord.
const GROUP_WINDOW_MS = 7 * 60 * 1000

type Row =
  | { kind: 'saved'; message: Message; author: PublicUser | null; at: string; grouped: boolean }
  | { kind: 'pending'; message: PendingMessage; author: PublicUser; at: string; grouped: boolean }

/**
 * The message list and composer, shared by DMs and groups. The page around it supplies the
 * header, the intro shown at the top of the history and who may delete what. Key it by
 * conversation, so switching starts with a fresh composer and scroll position.
 */
export function Chat({
  me,
  conversation,
  intro,
  placeholder,
  disabledReason,
  canDelete,
  hiddenAuthors,
}: {
  me: User
  conversation: Conversation
  intro: ReactNode
  placeholder: string
  disabledReason?: string
  canDelete: (message: Message) => boolean
  /** People you have blocked: their messages collapse until you choose to show them. */
  hiddenAuthors?: Set<string>
}) {
  const queryClient = useQueryClient()
  const { messages, fetchNextPage, hasNextPage, isFetchingNextPage, isSuccess } = useMessages(conversation.id)
  const pending = usePending(conversation.id)
  const [editing, setEditing] = useState<number | null>(null)
  const [replyTo, setReplyTo] = useState<ReplyPreview | null>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const [jumpTarget, setJumpTarget] = useState<number | null>(null)
  const [highlighted, setHighlighted] = useState<number | null>(null)
  const [jumpError, setJumpError] = useState('')

  const jumpToMessage = async (id: number) => {
    setJumpError('')
    try {
      let loaded = messages
      let more = hasNextPage
      while (!loaded.some((m) => m.id === id) && more) {
        const result = await fetchNextPage()
        if (result.isError) throw result.error
        loaded = result.data?.pages.flatMap((page) => page.data) ?? []
        more = result.hasNextPage
      }
      if (!loaded.some((m) => m.id === id)) {
        setJumpError('Original message is no longer available.')
        return
      }
      setJumpTarget(id)
    } catch {
      setJumpError('Could not load the original message. Try again.')
    }
  }

  useEffect(() => {
    if (jumpTarget === null) return
    const target = scrollBox.current?.querySelector(`[data-message-id="${jumpTarget}"]`)
    if (!target) return
    target.scrollIntoView({ block: 'center' })
    setHighlighted(jumpTarget)
    setJumpTarget(null)
  }, [jumpTarget, messages])

  useEffect(() => {
    if (highlighted === null) return
    const timer = setTimeout(() => setHighlighted(null), 2000)
    return () => clearTimeout(timer)
  }, [highlighted])

  // Once the saved copy of a pending message arrives (HTTP reply or WebSocket, whichever is
  // first), the grey copy disappears.
  const saved = new Set(messages.map((m) => m.nonce).filter(Boolean))
  const rows = toRows(messages, pending.filter((p) => !saved.has(p.nonce)), me)

  useMarkRead(conversation, messages.at(-1)?.id)
  const unread = useUnreadDivider(conversation, messages, !!hasNextPage, me)
  const typing = describeTyping(useTyping(conversation.id))

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

  // Older pages until the first unread message is loaded, then scroll to it (see the effect below).
  const [jumping, setJumping] = useState(false)
  const jump = async () => {
    setJumping(true)
    let oldest = messages[0]?.id ?? 0
    let more = hasNextPage
    while (more && oldest > (unread.after ?? 0)) {
      const result = await fetchNextPage()
      oldest = result.data?.pages.at(-1)?.data[0]?.id ?? 0
      more = result.hasNextPage
    }
  }

  const divider = useRef<HTMLDivElement>(null)
  const scrollBox = useRef<HTMLDivElement>(null)
  const [dividerSeen, setDividerSeen] = useState(false)
  const firstUnreadId = unread.first?.id

  useEffect(() => {
    if (jumping && divider.current) {
      divider.current.scrollIntoView({ block: 'center' })
      setJumping(false)
    }
  }, [jumping, firstUnreadId, messages])

  useEffect(() => {
    const target = divider.current
    if (!target) return
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setDividerSeen(true), { root: scrollBox.current })
    observer.observe(target)
    return () => observer.disconnect()
  }, [firstUnreadId])

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {unread.after !== null && !dividerSeen && (
        <div
          data-testid="unread-banner"
          className="absolute inset-x-4 top-0 z-10 flex items-center gap-3 rounded-b-lg bg-indigo-500 px-3 py-1 text-sm font-medium text-white shadow-lg"
        >
          <span className="min-w-0 flex-1 truncate">
            {unread.count} new {unread.count === 1 ? 'message' : 'messages'}
            {unread.first && ` since ${formatTime(unread.first.created_at, false)}`}
          </span>
          <button onClick={jump} className="hover:underline">
            Jump
          </button>
          <button onClick={unread.dismiss} className="hover:underline">
            Mark as read
          </button>
        </div>
      )}

      {/* The scroll box is column-reverse around a single child, so it stays pinned to the
          newest message and loading older ones above does not make it jump. */}
      <div ref={scrollBox} data-testid="messages" className="flex flex-1 flex-col-reverse overflow-y-auto">
        <div className="pb-4">
          <div ref={olderSentinel} className="min-h-px">
            {isFetchingNextPage && <p className="py-2 text-center text-sm text-zinc-500">Loading older messages…</p>}
          </div>

          {isSuccess && !hasNextPage && <div className="mx-4 mb-4 pt-8">{intro}</div>}

          {rows.map((row) =>
            row.kind === 'saved' ? (
              <Fragment key={row.message.id}>
                {row.message.id === firstUnreadId && (
                  <div ref={divider} data-testid="unread-divider" role="separator" aria-label="New messages" className="relative mx-4 mt-4 h-px bg-red-500">
                    <span className="absolute -top-2 right-0 rounded bg-red-500 px-1 text-[10px] leading-4 font-bold text-white uppercase">New</span>
                  </div>
                )}
                {row.message.type === 'system' ? (
                  <SystemRow message={row.message} />
                ) : (
                  <SavedRow
                    row={row.message.id === firstUnreadId ? { ...row, grouped: false } : row}
                    deletable={canDelete(row.message)}
                    hidden={!!row.author && !!hiddenAuthors?.has(row.author.id)}
                    conversationId={conversation.id}
                    editable={!disabledReason && row.author?.id === me.id}
                    editing={editing === row.message.id}
                    onEdit={() => setEditing(row.message.id)}
                    onEndEdit={() => {
                      setEditing(null)
                      composer.current?.focus()
                    }}
                    onReply={disabledReason ? undefined : () => {
                      setReplyTo({ id: row.message.id, author: row.author, body: [...row.message.body].slice(0, 200).join(''), deleted: false })
                      composer.current?.focus()
                    }}
                    onJump={jumpToMessage}
                    hiddenAuthors={hiddenAuthors}
                    highlighted={highlighted === row.message.id}
                  />
                )}
              </Fragment>
            ) : (
              <PendingRow key={row.message.nonce} row={row} />
            ),
          )}
        </div>
      </div>

      {jumpError && (
        <p role="alert" className="px-4 text-sm text-red-400">{jumpError}</p>
      )}

      <Composer
        onInputReady={(node) => { composer.current = node }}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onEditLatest={() => {
          const latest = messages.findLast((m) => m.type === 'text' && m.author?.id === me.id)
          if (latest) {
            setEditing(latest.id)
            void jumpToMessage(latest.id)
          }
        }}
        disabledReason={disabledReason}
        placeholder={placeholder}
        typing={typing}
        onType={() => sendTyping(conversation.id)}
        onSend={(body) => {
          if (disabledReason) return
          resetTyping(conversation.id)
          sendMessage(queryClient, conversation.id, body, undefined, replyTo)
          setReplyTo(null)
        }}
      />
    </div>
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
      !(row.kind === 'saved' ? row.message.reply_to : row.message.replyTo) &&
      !(prev.kind === 'saved' && prev.message.type === 'system') &&
      prev.author?.id === row.author.id &&
      new Date(row.at).getTime() - new Date(prev.at).getTime() < GROUP_WINDOW_MS
  })

  return rows
}

const fromOthers = (message: Message, me: User) => message.type === 'text' && message.author?.id !== me.id

/**
 * Where the red "New" line goes: after what you had read when you opened the chat, or when
 * you switched away from the tab with it open. It stays put while you're here, even though
 * the messages are marked as read, until Esc or "Mark as read".
 */
function useUnreadDivider(conversation: Conversation, messages: Message[], hasOlder: boolean, me: User) {
  // The list is kept fresh by live events; a single conversation's cache may be stale.
  const listed = useConversations().data?.find((c) => c.id === conversation.id) ?? conversation
  const [{ after, count }, setUnread] = useState(() => ({
    after: listed.unread_count > 0 ? (listed.last_read_message_id ?? 0) : null,
    count: listed.unread_count,
  }))

  const newest = messages.at(-1)
  const seenUpTo = useRef(0)

  useEffect(() => {
    if (!newest) return
    if (document.visibilityState === 'visible') {
      seenUpTo.current = newest.id
    } else if (after === null && fromOthers(newest, me) && newest.id > seenUpTo.current) {
      setUnread({ after: seenUpTo.current, count: 0 })
    }
  }, [newest, after, me])

  const dismiss = () => setUnread({ after: null, count: 0 })

  useEffect(() => {
    if (after === null) return
    const onKey = (event: globalThis.KeyboardEvent) => event.key === 'Escape' && dismiss()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [after])

  const unreadLoaded = after === null ? [] : messages.filter((m) => m.id > after && fromOthers(m, me))
  // Only once the page holding it has loaded, or the line would sit too low.
  const reachesBack = !hasOlder || (after !== null && messages.some((m) => m.id <= after))
  const first = reachesBack ? unreadLoaded[0] : undefined

  return {
    after,
    first,
    // Until the oldest unread is loaded, the count from when you opened the chat.
    count: Math.max(count, unreadLoaded.length),
    dismiss,
  }
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
      data-message-id={row.kind === 'saved' ? row.message.id : undefined}
      tabIndex={0}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button, textarea, a')) event.currentTarget.focus()
      }}
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
      {tools && <div className="absolute -top-3 right-4 hidden rounded bg-side shadow ring-1 ring-black/20 group-hover:flex group-focus-within:flex">{tools}</div>}
    </div>
  )
}

function SystemRow({ message }: { message: Message }) {
  return (
    <div data-testid="system-message" className="mt-2 flex gap-4 px-4 py-0.5 text-sm text-zinc-400">
      <span className="flex w-10 shrink-0 justify-center pt-0.5 text-emerald-500">
        <Icon name="arrowRight" className="size-4" />
      </span>
      <p>
        {message.meta && describeEvent(message.meta)}{' '}
        <span className="text-xs text-zinc-500">{formatTime(message.created_at, true)}</span>
      </p>
    </div>
  )
}

function SavedRow({
  row,
  deletable,
  hidden,
  conversationId,
  editable,
  editing,
  onEdit,
  onEndEdit,
  onReply,
  onJump,
  hiddenAuthors,
  highlighted,
}: {
  row: Extract<Row, { kind: 'saved' }>
  deletable: boolean
  hidden: boolean
  conversationId: number
  editable: boolean
  editing: boolean
  onEdit: () => void
  onEndEdit: () => void
  onReply?: () => void
  onJump: (id: number) => void
  hiddenAuthors?: Set<string>
  highlighted: boolean
}) {
  const remove = useDeleteMessage(conversationId)
  const confirm = useConfirm()
  const [revealed, setRevealed] = useState(false)

  // Shift-click skips the question, as in Discord.
  const deleteMessage = async (skip: boolean) => {
    const ok =
      skip ||
      (await confirm({
        title: 'Delete message',
        body: (
          <>
            <span className="mb-3 block">Are you sure you want to delete this message?</span>
            <span className="block max-h-40 overflow-hidden rounded-md bg-side px-3 py-2 text-zinc-200 shadow ring-1 ring-black/20">
              <span className="block font-medium text-white">{nameOf(row.author)}</span>
              <span className="line-clamp-4 break-words whitespace-pre-wrap">{row.message.body}</span>
            </span>
            <span className="mt-3 block text-xs">
              Tip: hold <kbd className="font-semibold text-zinc-300">Shift</kbd> when you click delete to skip this.
            </span>
          </>
        ),
        action: 'Delete',
        danger: true,
      }))
    if (ok) remove.mutate(row.message.id)
  }

  if (hidden && !revealed) {
    return (
      <div data-testid="message-blocked" data-message-id={row.message.id} className="mt-2 px-4 py-0.5 pl-18 text-sm text-zinc-500">
        Blocked message ·{' '}
        <button onClick={() => setRevealed(true)} className="font-medium text-zinc-400 hover:underline">
          Show
        </button>
      </div>
    )
  }

  return (
    <RowShell
      row={row}
      testId="message"
      tools={
        <>
          {onReply && (
            <button aria-label="Reply to message" title="Reply" onClick={onReply} className="p-1.5 text-xs text-zinc-400 hover:text-white">
              Reply
            </button>
          )}
          {editable && (
            <button aria-label="Edit message" title="Edit" onClick={onEdit} className="p-1.5 text-xs text-zinc-400 hover:text-white">
              Edit
            </button>
          )}
          {deletable && (
            <button
              aria-label="Delete message"
              title="Delete message"
              onClick={(event) => deleteMessage(event.shiftKey)}
              className="p-1.5 text-zinc-400 hover:text-red-400"
            >
              <Icon name="trash" className="size-4" />
            </button>
          )}
        </>
      }
    >
      {row.message.reply_to && <ReplyQuote reply={row.message.reply_to} onJump={onJump} hiddenAuthors={hiddenAuthors} />}
      {editing && editable ? (
        <MessageEditor key={row.message.id} message={row.message} onDone={onEndEdit} />
      ) : (
        <p className={`break-words whitespace-pre-wrap text-zinc-100 ${highlighted ? 'rounded bg-indigo-500/20' : ''}`}>
          <Linkified text={row.message.body} />
          {row.message.edited_at && (
            <span title={new Date(row.message.edited_at).toLocaleString()} className="ml-1 text-[10px] text-zinc-500">(edited)</span>
          )}
        </p>
      )}
    </RowShell>
  )
}

function ReplyQuote({ reply, onJump, hiddenAuthors }: { reply: ReplyPreview; onJump?: (id: number) => void; hiddenAuthors?: Set<string> }) {
  const hidden = !!reply.author && hiddenAuthors?.has(reply.author.id)
  return (
    <button
      type="button"
      data-testid="reply-preview"
      disabled={reply.deleted || !onJump}
      onClick={() => onJump?.(reply.id)}
      className="mb-1 block w-full truncate border-l-2 border-zinc-500 pl-2 text-left text-xs text-zinc-400 enabled:hover:text-zinc-200"
    >
      {reply.deleted ? 'Original message deleted' : hidden ? 'Blocked message' : (
        <><strong>{nameOf(reply.author)}</strong>: {reply.body}</>
      )}
    </button>
  )
}

function MessageEditor({ message, onDone }: { message: Message; onDone: () => void }) {
  const [body, setBody] = useState(message.body)
  const edit = useEditMessage(message.conversation_id)
  const save = () => {
    if (body.trim() && !edit.isPending) edit.mutate({ id: message.id, body: body.trim() }, { onSuccess: onDone })
  }
  return (
    <div className="rounded bg-field p-2">
      <textarea
        aria-label="Edit message text"
        autoFocus
        value={body}
        maxLength={MAX_LENGTH}
        disabled={edit.isPending}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Escape') {
            e.stopPropagation()
            onDone()
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            save()
          }
        }}
        className="block w-full resize-y bg-transparent text-zinc-100 outline-none"
      />
      {edit.isError && (
        <p role="alert" className="text-sm text-red-400">{edit.error.message || 'Could not save. Try again.'}</p>
      )}
      <p className="flex gap-3 text-xs text-zinc-400">
        <button disabled={edit.isPending} onClick={onDone}>Cancel (Esc)</button>
        <button disabled={!body.trim() || edit.isPending} onClick={save} className="text-indigo-300">Save (Enter)</button>
      </p>
    </div>
  )
}

function PendingRow({ row }: { row: Extract<Row, { kind: 'pending' }> }) {
  const queryClient = useQueryClient()
  const { message } = row
  const failed = message.status === 'failed'

  return (
    <RowShell row={row} testId={failed ? 'message-failed' : 'message-pending'}>
      {message.replyTo && <ReplyQuote reply={message.replyTo} />}
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
  typing,
  onType,
  onSend,
  onInputReady,
  replyTo,
  onCancelReply,
  onEditLatest,
}: {
  placeholder: string
  disabledReason?: string
  typing: string | null
  onType: () => void
  onSend: (body: string) => void
  onInputReady: (node: HTMLTextAreaElement | null) => void
  replyTo: ReplyPreview | null
  onCancelReply: () => void
  onEditLatest: () => void
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
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape' && replyTo) {
      event.stopPropagation()
      onCancelReply()
      return
    }
    if (event.key === 'ArrowUp' && !body && !replyTo) {
      event.preventDefault()
      onEditLatest()
      return
    }
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (!body.trim()) return
    onSend(body.trim())
    setBody('')
  }

  return (
    <div className="shrink-0 px-4">
      {replyTo && !disabledReason && (
        <div data-testid="replying-to" className="flex items-center gap-2 rounded-t bg-side px-3 py-2 text-xs text-zinc-300">
          <span className="min-w-0 flex-1 truncate">Replying to <strong>{nameOf(replyTo.author)}</strong>: {replyTo.body}</span>
          <button aria-label="Cancel reply" onClick={onCancelReply}>✕</button>
        </div>
      )}
      {disabledReason ? (
        <p className="rounded-lg bg-field px-4 py-3 text-sm text-zinc-400">{disabledReason}</p>
      ) : (
        <div className="rounded-lg bg-field px-4 py-2.5">
          <textarea
            ref={(node) => {
              input.current = node
              onInputReady(node)
            }}
            rows={1}
            value={body}
            maxLength={MAX_LENGTH}
            onChange={(e) => {
              setBody(e.target.value)
              if (e.target.value.trim()) onType()
            }}
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
      <p data-testid="typing" aria-live="polite" className="flex h-6 items-center gap-1.5 truncate text-xs text-zinc-300">
        {typing && (
          <>
            <TypingDots />
            {typing}
          </>
        )}
      </p>
    </div>
  )
}

function TypingDots() {
  return (
    <span aria-hidden className="flex gap-0.5">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="size-1 animate-bounce rounded-full bg-zinc-300" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  )
}

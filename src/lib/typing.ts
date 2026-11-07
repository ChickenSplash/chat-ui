import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { api } from './api'
import type { PublicUser } from './friends'

// Who is typing where. Each signal lasts a few seconds; senders repeat it every 3 s while
// they type, and their message arriving clears it at once.

const SEND_EVERY_MS = 3000
const SHOWN_FOR_MS = 5000

type Typist = { user: PublicUser; until: number }

let typing = new Map<number, Typist[]>()
const listeners = new Set<() => void>()

function update(conversationId: number, change: (list: Typist[]) => Typist[]) {
  const now = Date.now()
  const next = change((typing.get(conversationId) ?? []).filter((t) => t.until > now))
  typing = new Map(typing)
  if (next.length) typing.set(conversationId, next)
  else typing.delete(conversationId)
  listeners.forEach((listener) => listener())
}

export function startedTyping(conversationId: number, user: PublicUser) {
  update(conversationId, (list) => [...list.filter((t) => t.user.id !== user.id), { user, until: Date.now() + SHOWN_FOR_MS }])
}

export function stoppedTyping(conversationId: number, userId: string) {
  if (typing.get(conversationId)?.some((t) => t.user.id === userId)) {
    update(conversationId, (list) => list.filter((t) => t.user.id !== userId))
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** People typing in a conversation, rechecked every second so stale ones drop off. */
export function useTyping(conversationId: number): PublicUser[] {
  const all = useSyncExternalStore(subscribe, () => typing)
  const [now, setNow] = useState(Date.now)
  const list = all.get(conversationId)

  useEffect(() => {
    if (!list?.length) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [list])

  return useMemo(() => (list ?? []).filter((t) => t.until > now).map((t) => t.user), [list, now])
}

const lastSent = new Map<number, number>()

/** Call on every keystroke; it only reaches the server every few seconds. */
export function sendTyping(conversationId: number) {
  if (Date.now() - (lastSent.get(conversationId) ?? 0) < SEND_EVERY_MS) return
  lastSent.set(conversationId, Date.now())
  api('POST', `/api/conversations/${conversationId}/typing`).catch(() => {})
}

/** After sending, the next keystroke signals straight away. */
export function resetTyping(conversationId: number) {
  lastSent.delete(conversationId)
}

export function describeTyping(users: PublicUser[]): string | null {
  const names = users.map((u) => u.display_name)
  if (names.length === 0) return null
  if (names.length === 1) return `${names[0]} is typing…`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]} are typing…`
  return 'Several people are typing…'
}

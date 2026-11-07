import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from './api'
import { ME, type User } from './auth'

/** What others see. */
export type Status = 'online' | 'idle' | 'dnd' | 'offline'

/** What you pick. Invisible looks offline to everyone else. */
export type Preference = 'online' | 'idle' | 'dnd' | 'invisible'

export const STATUS_LABEL: Record<Status | Preference, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  invisible: 'Invisible',
  offline: 'Offline',
}

// Spelled out in full so Tailwind finds the classes.
export const STATUS_DOT: Record<Status, string> = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-400',
  dnd: 'bg-red-500',
  offline: 'bg-zinc-500',
}

export const PRESENCE = ['presence']

/**
 * Everyone you can see who isn't offline (friends and people you share a DM or group with),
 * kept current by `presence.changed` events. Anyone missing is offline.
 */
export const usePresence = () =>
  useQuery({ queryKey: PRESENCE, queryFn: () => api<Record<string, Status>>('GET', '/api/presence'), staleTime: Infinity })

export function useStatusOf(id: string | undefined): Status {
  const presence = usePresence()
  return (id && presence.data?.[id]) || 'offline'
}

export function setStatusOf(queryClient: QueryClient, id: string, status: Status) {
  queryClient.setQueryData<Record<string, Status>>(PRESENCE, (map) => {
    const next = { ...map }
    if (status === 'offline') delete next[id]
    else next[id] = status
    return next
  })
}

export function useSetStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (status: Preference) => api<User>('PUT', '/api/presence/status', { status }),
    onSuccess: (user) => queryClient.setQueryData(ME, user),
  })
}

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'focus'] as const
const REPORT_EVERY_MS = 60_000

/**
 * Tells HMS you're still here, at most once a minute while you use the app. Ten quiet
 * minutes and you show as idle; the next touch reports straight away and you're back.
 */
export function useActivityReporter() {
  useEffect(() => {
    let lastReport = Date.now()

    const onActivity = () => {
      if (Date.now() - lastReport < REPORT_EVERY_MS) return
      lastReport = Date.now()
      // Failed? Try again on activity in 10 s or so.
      api('POST', '/api/presence/active').catch(() => (lastReport = Date.now() - REPORT_EVERY_MS + 10_000))
    }

    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity, { passive: true })
    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity)
    }
  }, [])
}

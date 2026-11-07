import Echo from 'laravel-echo'
import Pusher, { type AuthorizerCallback } from 'pusher-js'
import { useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import type { User } from './auth'
import { RealtimeContext, type ConnectionState, type Realtime } from './realtime-context'

async function connect(): Promise<Echo<'reverb'>> {
  const { key } = await api<{ key: string }>('GET', '/api/realtime')
  const secure = location.protocol === 'https:'
  const port = Number(location.port) || (secure ? 443 : 80)

  // Reverb is reached through this app's own origin (/app), proxied to hms-reverb.
  return new Echo({
    broadcaster: 'reverb',
    Pusher,
    key,
    wsHost: location.hostname,
    wsPort: port,
    wssPort: port,
    forceTLS: secure,
    enabledTransports: ['ws', 'wss'],
    // Through our fetch wrapper, so private channel auth carries the session and CSRF token.
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: AuthorizerCallback) => {
        api<{ auth: string }>('POST', '/api/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
          .then((data) => callback(null, data))
          .catch((error: Error) => callback(error, null))
      },
    }),
  })
}

/** One WebSocket per signed-in user, torn down when they sign out or switch accounts. */
export function RealtimeProvider({ user, children }: { user: User; children: ReactNode }) {
  const [realtime, setRealtime] = useState<Realtime>({ echo: null, state: 'connecting' })

  useEffect(() => {
    let echo: Echo<'reverb'> | null = null
    let cancelled = false

    connect()
      .then((created) => {
        if (cancelled) return created.disconnect()
        echo = created
        const connection = created.connector.pusher.connection
        const update = () =>
          setRealtime({ echo: created, state: toState(connection.state) })
        connection.bind('state_change', update)
        update()
      })
      .catch(() => !cancelled && setRealtime({ echo: null, state: 'unavailable' }))

    return () => {
      cancelled = true
      echo?.disconnect()
    }
  }, [user.id])

  return <RealtimeContext value={realtime}>{children}</RealtimeContext>
}

function toState(pusherState: string): ConnectionState {
  if (pusherState === 'connected') return 'connected'
  if (pusherState === 'unavailable' || pusherState === 'failed') return 'unavailable'
  if (pusherState === 'disconnected') return 'disconnected'
  return 'connecting'
}

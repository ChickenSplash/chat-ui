import { useEffect, useRef, useState } from 'react'
import { Button, Card, ErrorNote, GuestBadge } from '../components/ui'
import { api } from '../lib/api'
import type { User } from '../lib/auth'
import { useRealtime } from '../lib/realtime-context'

type Ping = { sentAt: number; roundTrip?: number }

/** Placeholder until chats land: proves sign-in and the live connection both work. */
export function Home({ user }: { user: User }) {
  const { echo, state } = useRealtime()
  const [ping, setPing] = useState<Ping | null>(null)
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)
  const pending = useRef<number | null>(null)

  useEffect(() => {
    if (!echo) return

    const channel = `user.${user.id}`
    echo.private(channel).listen('.ping', () => {
      if (pending.current === null) return
      const sentAt = pending.current
      pending.current = null
      setPing({ sentAt, roundTrip: Math.round(performance.now() - sentAt) })
    })

    return () => echo.leave(channel)
  }, [echo, user.id])

  const sendPing = async () => {
    setError(undefined)
    const sentAt = performance.now()
    pending.current = sentAt
    setPing({ sentAt })

    try {
      await api('POST', '/api/ping')
    } catch (e) {
      pending.current = null
      setPing(null)
      setError(e instanceof Error ? e.message : 'Ping failed.')
    }
  }

  const copyId = async () => {
    await navigator.clipboard.writeText(user.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-sm text-zinc-500">Connected as</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold">
          {user.display_name}
          {user.is_guest && <GuestBadge />}
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
          Your ID
          <code data-testid="public-id" className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
            #{user.id}
          </code>
          <button onClick={copyId} className="text-indigo-600 hover:underline dark:text-indigo-400">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </p>
        <p className="mt-1 text-sm text-zinc-500">Share your ID so friends can find you.</p>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Live connection</h2>
            <p className="text-sm text-zinc-500">
              Status: <span data-testid="connection-state">{state}</span>. A ping goes to the server and comes back
              over the WebSocket.
            </p>
          </div>
          <Button onClick={sendPing} disabled={state !== 'connected' || (ping !== null && ping.roundTrip === undefined)}>
            Ping
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          <ErrorNote>{error}</ErrorNote>
          {ping && (
            <p data-testid="ping-result" className="text-sm">
              {ping.roundTrip === undefined ? 'Waiting for the echo…' : `Pong in ${ping.roundTrip} ms`}
            </p>
          )}
        </div>
      </Card>

      <p className="text-center text-sm text-zinc-500">Friends, DMs and groups are coming next.</p>
    </div>
  )
}

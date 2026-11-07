import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { User } from './auth'
import { addMessage, CONVERSATIONS, removeMessage, type Message } from './conversations'
import { BLOCKS, FRIENDS } from './friends'
import { useRealtime } from './realtime-context'

/** Applies everything HMS pushes on your own channel to the query cache. Mounted once, in the layout. */
export function useLiveUpdates(user: User) {
  const { echo, state } = useRealtime()
  const queryClient = useQueryClient()
  const wasConnected = useRef(false)

  useEffect(() => {
    if (!echo) return

    const conversations = () => queryClient.invalidateQueries({ queryKey: CONVERSATIONS })
    const handlers: Record<string, (payload: never) => void> = {
      '.friends.changed': () => {
        queryClient.invalidateQueries({ queryKey: FRIENDS })
        queryClient.invalidateQueries({ queryKey: BLOCKS })
        conversations()
      },
      '.message.sent': (message: Message) => {
        addMessage(queryClient, message)
        conversations()
      },
      '.message.deleted': ({ conversation_id, id }: { conversation_id: number; id: number }) => {
        removeMessage(queryClient, conversation_id, id)
        conversations()
      },
      '.conversation.read': conversations,
      '.conversations.changed': conversations,
    }

    // Not echo.leave(): other screens (the ping in settings) listen on the same channel.
    const channel = echo.private(`user.${user.id}`)
    for (const [event, handler] of Object.entries(handlers)) channel.listen(event, handler)

    // Lists fetched before the subscription went through could have missed an event.
    channel.subscribed(() => {
      queryClient.invalidateQueries({ queryKey: FRIENDS })
      conversations()
    })

    return () => {
      for (const [event, handler] of Object.entries(handlers)) channel.stopListening(event, handler)
    }
  }, [echo, user.id, queryClient])

  // Anything pushed while the socket was down is lost, so catch up after a reconnect.
  useEffect(() => {
    if (state !== 'connected') return
    if (wasConnected.current) queryClient.invalidateQueries()
    wasConnected.current = true
  }, [state, queryClient])
}

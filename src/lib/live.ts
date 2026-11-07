import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { ME, type User } from './auth'
import { addMessage, CONVERSATIONS, removeMessage, type Message } from './conversations'
import { BLOCKS, FRIENDS, type PublicUser } from './friends'
import { GROUPS, membersKey } from './groups'
import { PRESENCE, setStatusOf, type Status } from './presence'
import { useRealtime } from './realtime-context'
import { startedTyping, stoppedTyping } from './typing'

/** Applies everything HMS pushes on your own channel to the query cache. Mounted once, in the layout. */
export function useLiveUpdates(user: User) {
  const { echo, state } = useRealtime()
  const queryClient = useQueryClient()
  const wasConnected = useRef(false)

  useEffect(() => {
    if (!echo) return

    const conversations = () => queryClient.invalidateQueries({ queryKey: CONVERSATIONS })
    // Whose status you can see changes with friendships, blocks and memberships.
    const presence = () => queryClient.invalidateQueries({ queryKey: PRESENCE })
    const handlers: Record<string, (payload: never) => void> = {
      '.friends.changed': () => {
        queryClient.invalidateQueries({ queryKey: FRIENDS })
        queryClient.invalidateQueries({ queryKey: BLOCKS })
        conversations()
        presence()
      },
      '.message.sent': (message: Message) => {
        addMessage(queryClient, message)
        conversations()
        if (message.author) stoppedTyping(message.conversation_id, message.author.id)
        // Joins, kicks and role changes arrive as system messages.
        if (message.type === 'system') {
          queryClient.invalidateQueries({ queryKey: membersKey(message.conversation_id) })
          presence()
        }
      },
      '.message.deleted': ({ conversation_id, id }: { conversation_id: number; id: number }) => {
        removeMessage(queryClient, conversation_id, id)
        conversations()
      },
      '.conversation.read': conversations,
      '.conversations.changed': () => {
        conversations()
        queryClient.invalidateQueries({ queryKey: GROUPS })
        presence()
      },
      '.presence.changed': ({ id, status }: { id: string; status: Status }) => {
        setStatusOf(queryClient, id, status)
        // Your own status, picked in another tab.
        if (id === user.id) queryClient.invalidateQueries({ queryKey: ME })
      },
      '.typing': ({ conversation_id, user: typist }: { conversation_id: number; user: PublicUser }) =>
        startedTyping(conversation_id, typist),
    }

    // Not echo.leave(): other screens (the ping in settings) listen on the same channel.
    const channel = echo.private(`user.${user.id}`)
    for (const [event, handler] of Object.entries(handlers)) channel.listen(event, handler)

    // Lists fetched before the subscription went through could have missed an event.
    channel.subscribed(() => {
      queryClient.invalidateQueries({ queryKey: FRIENDS })
      conversations()
      presence()
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

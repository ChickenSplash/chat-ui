import type Echo from 'laravel-echo'
import { createContext, useContext } from 'react'

export type ConnectionState = 'connecting' | 'connected' | 'unavailable' | 'disconnected'

export type Realtime = {
  echo: Echo<'reverb'> | null
  state: ConnectionState
}

export const RealtimeContext = createContext<Realtime>({ echo: null, state: 'disconnected' })

export const useRealtime = () => useContext(RealtimeContext)

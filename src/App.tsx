import { Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { ErrorNote } from './components/ui'
import { useMe } from './lib/auth'
import { RealtimeProvider } from './lib/realtime'
import { DirectMessage } from './pages/DirectMessage'
import { Friends } from './pages/Friends'
import { Settings } from './pages/Settings'
import { Welcome } from './pages/Welcome'

export default function App() {
  const me = useMe()

  if (me.isPending) return null

  if (me.isError) {
    return (
      <main className="mx-auto max-w-md px-4 py-24">
        <ErrorNote>Can't reach the server right now. Try again in a moment.</ErrorNote>
      </main>
    )
  }

  const user = me.data

  if (!user) return <Welcome />

  return (
    <RealtimeProvider user={user}>
      <Routes>
        <Route element={<Layout user={user} />}>
          <Route index element={<Friends />} />
          <Route path="dm/:id" element={<DirectMessage user={user} />} />
          <Route path="settings" element={<Settings user={user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </RealtimeProvider>
  )
}

import { Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { ErrorNote } from './components/ui'
import { useMe } from './lib/auth'
import { RealtimeProvider } from './lib/realtime'
import { DirectMessage } from './pages/DirectMessage'
import { Explore } from './pages/Explore'
import { Friends } from './pages/Friends'
import { Group } from './pages/Group'
import { GroupSettings } from './pages/GroupSettings'
import { Invite } from './pages/Invite'
import { NewGroup } from './pages/NewGroup'
import { Settings } from './pages/Settings'
import { Terms } from './pages/Terms'
import { Welcome } from './pages/Welcome'

export default function App() {
  return (
    <Routes>
      <Route path="terms" element={<Terms />} />
      <Route path="*" element={<Main />} />
    </Routes>
  )
}

function Main() {
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
          <Route path="groups/new" element={<NewGroup />} />
          <Route path="groups/explore" element={<Explore />} />
          <Route path="groups/:id" element={<Group user={user} />} />
          <Route path="groups/:id/settings" element={<GroupSettings />} />
          <Route path="invite/:code" element={<Invite />} />
          <Route path="settings" element={<Settings user={user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </RealtimeProvider>
  )
}

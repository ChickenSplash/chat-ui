import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { ErrorNote } from './components/ui'
import { goToSignIn, TERMS_URL } from './lib/accounts'
import { useMe } from './lib/auth'
import { RealtimeProvider } from './lib/realtime'
import { DirectMessage } from './pages/DirectMessage'
import { Explore } from './pages/Explore'
import { Friends } from './pages/Friends'
import { Group } from './pages/Group'
import { Invite } from './pages/Invite'

export default function App() {
  return (
    <Routes>
      <Route path="terms" element={<Away to={TERMS_URL} />} />
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

  if (!user) return <SignIn />

  return (
    <RealtimeProvider user={user}>
      <Routes>
        <Route element={<Layout user={user} />}>
          <Route index element={<Friends />} />
          <Route path="dm/:id" element={<DirectMessage user={user} />} />
          <Route path="groups/explore" element={<Explore />} />
          <Route path="groups/:id" element={<Group user={user} />} />
          <Route path="invite/:code" element={<Invite />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </RealtimeProvider>
  )
}

/** Signed out: off to the shared sign-in site, which sends you back to this same page. */
function SignIn() {
  useEffect(() => goToSignIn(), [])
  return null
}

/** The terms live on the sign-in site now; old links still land there. */
function Away({ to }: { to: string }) {
  useEffect(() => window.location.replace(to), [to])
  return null
}

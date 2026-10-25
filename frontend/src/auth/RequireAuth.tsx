import { Navigate, Outlet, useLocation } from 'react-router'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, FullPageSpinner } from '../components/ui'
import { useAuth } from './useAuth'

function ServerUnavailable() {
  const { retry } = useAuth()
  return (
    <AuthShell title="Can’t reach DueProof right now">
      <Alert>The server isn’t responding. It may be starting up or restarting. Your data is safe.</Alert>
      <Button className="mt-4 w-full" onClick={retry}>Try again</Button>
    </AuthShell>
  )
}

/** Pages inside this route need a logged-in member; others are sent to /login and brought back after. */
export function RequireAuth() {
  const { me, loading, unavailable } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (unavailable) return <ServerUnavailable />
  if (!me) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <Outlet />
}

/** Login and signup pages: a logged-in person goes straight to the dashboard. */
export function RedirectIfLoggedIn() {
  const { me, loading, unavailable } = useAuth()
  if (loading) return <FullPageSpinner />
  if (unavailable) return <ServerUnavailable />
  if (me) return <Navigate to="/" replace />
  return <Outlet />
}

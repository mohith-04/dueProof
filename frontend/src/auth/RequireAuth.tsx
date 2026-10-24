import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageSpinner } from '../components/ui'
import { useAuth } from './useAuth'

/** Pages inside this route need a logged-in member; others are sent to /login and brought back after. */
export function RequireAuth() {
  const { me, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!me) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <Outlet />
}

/** Login and signup pages: a logged-in person goes straight to the dashboard. */
export function RedirectIfLoggedIn() {
  const { me, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (me) return <Navigate to="/" replace />
  return <Outlet />
}

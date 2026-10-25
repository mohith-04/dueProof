import { AppLayout } from '../components/AppLayout'
import { FullPageSpinner } from '../components/ui'
import DashboardPage from '../pages/DashboardPage'
import LandingPage from '../pages/LandingPage'
import { ServerUnavailable } from './RequireAuth'
import { useAuth } from './useAuth'

/** "/" shows the public landing page to visitors and the dashboard to logged-in members. */
export function HomeRoute() {
  const { me, loading, unavailable } = useAuth()
  if (loading) return <FullPageSpinner />
  if (unavailable) return <ServerUnavailable />
  if (!me) return <LandingPage />
  return (
    <AppLayout>
      <DashboardPage />
    </AppLayout>
  )
}

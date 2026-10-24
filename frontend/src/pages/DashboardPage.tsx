import { useAuth } from '../auth/useAuth'
import { Card } from '../components/ui'

/** Placeholder until obligations exist; replaced by the real dashboard in a later step. */
export default function DashboardPage() {
  const { me } = useAuth()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          {me?.org.name} · timezone {me?.org.timezone}
        </p>
      </div>
      <Card className="p-8 text-center">
        <p className="font-medium">No obligations yet</p>
        <p className="mt-1 text-sm text-slate-600">Recurring compliance tasks will appear here, grouped by what needs attention first.</p>
      </Card>
    </div>
  )
}

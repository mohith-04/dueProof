import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { OccurrenceList } from '../components/OccurrenceList'
import { Alert, Card, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { CATEGORIES, formatDate } from '../lib/format'
import type { Dashboard, OccurrenceItem } from '../lib/types'
import { useTitle } from '../lib/useTitle'

type Filters = { mine: boolean; category: string }

export default function DashboardPage() {
  useTitle('Dashboard')
  const { me } = useAuth()
  const isAdmin = me?.member.role === 'admin'
  const [filters, setFilters] = useState<Filters>({ mine: false, category: '' })
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (filters.mine) params.set('mine', '1')
    if (filters.category) params.set('category', filters.category)
    api<Dashboard>(`/dashboard/?${params}`)
      .then((d) => { if (!cancelled) { setData(d); setError(false) } })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [filters])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            {data ? `Today is ${formatDate(data.today)} in ${me?.org.timezone}` : me?.org.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm" role="group" aria-label="Whose items">
            {[{ label: 'Everyone', mine: false }, { label: 'My items', mine: true }].map((option) => (
              <button key={option.label} type="button" aria-pressed={filters.mine === option.mine}
                onClick={() => setFilters((f) => ({ ...f, mine: option.mine }))}
                className={`rounded-md px-3 py-1.5 ${filters.mine === option.mine ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                {option.label}
              </button>
            ))}
          </div>
          <select aria-label="Category" value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {error && <Alert>Couldn't load the dashboard. Refresh the page to try again.</Alert>}
      {!data && !error && <div className="flex justify-center py-16 text-slate-400"><Spinner className="h-8 w-8" /></div>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CountCard label="Overdue" value={data.counts.overdue} tone="red" />
            <CountCard label="Due soon" value={data.counts.due_soon} tone="amber" />
            <CountCard label="Coming up (45 days)" value={data.counts.upcoming} tone="slate" />
            <CountCard label="Done (30 days)" value={data.counts.completed_last_30_days} tone="emerald" />
          </div>

          {data.counts.active_obligations === 0 ? (
            <Card className="p-10 text-center">
              <p className="font-medium">{filters.mine || filters.category ? 'Nothing matches these filters' : 'No obligations yet'}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                {isAdmin
                  ? 'Add the recurring tasks your team must do and prove, such as tax filings or access reviews. Start from a template.'
                  : 'Your admin hasn’t added any recurring tasks yet.'}
              </p>
              {isAdmin && !filters.mine && !filters.category && (
                <Link to="/obligations/new" className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                  Create your first obligation
                </Link>
              )}
            </Card>
          ) : (
            <>
              <Section title="Overdue" items={data.overdue} empty="Nothing overdue. Nice." tone="red" />
              <Section title="Due soon" items={data.due_soon} empty="Nothing inside its reminder window." tone="amber" />
              <Section title="Upcoming" note="next due date of each obligation" items={data.upcoming} empty="Nothing due in the next 45 days." />
              {data.recently_completed.length > 0 && (
                <Section title="Recently completed" items={data.recently_completed} empty="" />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function CountCard({ label, value, tone }: { label: string; value: number; tone: 'red' | 'amber' | 'slate' | 'emerald' }) {
  const colour = { red: 'text-red-700', amber: 'text-amber-700', slate: 'text-slate-900', emerald: 'text-emerald-700' }[tone]
  return (
    <Card className="px-4 py-3">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${value > 0 ? colour : 'text-slate-400'}`}>{value}</p>
    </Card>
  )
}

function Section({ title, note, items, empty, tone }: { title: string; note?: string; items: OccurrenceItem[]; empty: string; tone?: 'red' | 'amber' }) {
  const accent = tone === 'red' && items.length ? 'border-l-4 border-l-red-500' : tone === 'amber' && items.length ? 'border-l-4 border-l-amber-400' : ''
  return (
    <Card className={`overflow-hidden ${accent}`}>
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">
        {title} <span className="font-normal text-slate-500">({items.length}){note && ` · ${note}`}</span>
      </h2>
      {items.length ? <OccurrenceList items={items} /> : <p className="px-4 py-6 text-sm text-slate-500">{empty}</p>}
    </Card>
  )
}

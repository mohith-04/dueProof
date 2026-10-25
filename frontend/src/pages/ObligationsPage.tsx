import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Alert, Badge, Card, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { CATEGORIES, formatDate } from '../lib/format'
import type { Obligation } from '../lib/types'
import { useTitle } from '../lib/useTitle'

export default function ObligationsPage() {
  useTitle('Obligations')
  const { me } = useAuth()
  const isAdmin = me?.member.role === 'admin'
  const [archived, setArchived] = useState(false)
  const [category, setCategory] = useState('')
  const [obligations, setObligations] = useState<Obligation[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ archived: String(archived) })
    if (category) params.set('category', category)
    api<Obligation[]>(`/obligations/?${params}`)
      .then((list) => { if (!cancelled) { setObligations(list); setError(false) } })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [archived, category])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Obligations</h1>
          <p className="mt-1 text-sm text-slate-600">Recurring tasks your team must do on schedule and be able to prove.</p>
        </div>
        {isAdmin && (
          <Link to="/obligations/new" className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            New obligation
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm" role="group" aria-label="Show">
          {[{ label: 'Active', value: false }, { label: 'Archived', value: true }].map((tab) => (
            <button key={tab.label} type="button" aria-pressed={archived === tab.value} onClick={() => setArchived(tab.value)}
              className={`rounded-md px-3 py-1.5 ${archived === tab.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {error && <Alert>Couldn't load obligations. Refresh the page to try again.</Alert>}

      <Card className="overflow-hidden">
        {obligations === null && !error ? (
          <div className="flex justify-center p-10 text-slate-400"><Spinner /></div>
        ) : obligations && obligations.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {archived ? 'No archived obligations.' : category ? 'No obligations in this category.' : 'No obligations yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Obligation</th>
                  <th className="px-4 py-3 font-medium">Schedule</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">{archived ? 'Archived' : 'Next due'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {obligations?.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/obligations/${o.id}`} className="font-medium text-slate-900 hover:text-indigo-700">{o.title}</Link>
                      <div className="mt-1 flex gap-1.5">
                        <Badge>{o.category_label}</Badge>
                        {o.evidence_required && <Badge tone="indigo">proof required</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{o.schedule}</td>
                    <td className="px-4 py-3 text-slate-600">{o.owner.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {archived ? (o.archived_at && formatDate(o.archived_at)) : o.next_due ? formatDate(o.next_due) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

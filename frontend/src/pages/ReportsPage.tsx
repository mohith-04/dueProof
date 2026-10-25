import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Badge, Card, Spinner } from '../components/ui'
import { api, toFormErrors } from '../lib/api'
import { CATEGORIES, formatDate, formatDateTime } from '../lib/format'
import { REPORT_STATUS_TONE, type Report } from '../lib/reports'
import type { Member } from '../lib/types'

type Filters = { from: string; to: string; category: string; owner: string; status: string }

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const PRESETS = [
  { label: 'Last 90 days', from: () => isoDaysAgo(90), to: () => isoDaysAgo(0) },
  { label: 'Last 12 months', from: () => isoDaysAgo(365), to: () => isoDaysAgo(0) },
  { label: 'Next 90 days', from: () => isoDaysAgo(0), to: () => isoDaysAgo(-90) },
]

const inputClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'

/** "Prove you did X": every due item in a period, with completion and proof, exportable to CSV. */
export default function ReportsPage() {
  const [filters, setFilters] = useState<Filters>({ from: isoDaysAgo(90), to: isoDaysAgo(0), category: '', owner: '', status: '' })
  const [members, setMembers] = useState<Member[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value) })
    return params.toString()
  }, [filters])

  useEffect(() => {
    api<Member[]>('/org/members/').then(setMembers).catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      api<Report>(`/reports/?${query}`)
        .then((r) => { if (!cancelled) { setReport(r); setError(null) } })
        .catch((e) => {
          if (cancelled) return
          const errors = toFormErrors(e)
          setError(errors.general ?? Object.values(errors.fields)[0] ?? 'Couldn’t load the report.')
        })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 250) // typing a date fires many changes; wait for the last one
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }))

  const s = report?.summary

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="mt-1 text-sm text-slate-600">Everything that was due in a period: whether it was done on time, by whom, and with what proof.</p>
        </div>
        <a href={`/api/reports/export.csv?${query}`}
          className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium ${error ? 'pointer-events-none bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          aria-disabled={Boolean(error)}>
          Download CSV
        </a>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => setFilters((f) => ({ ...f, from: p.from(), to: p.to() }))}
              className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:border-slate-400">
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm text-slate-700">Due from<input type="date" className={inputClass} value={filters.from} onChange={set('from')} /></label>
          <label className="text-sm text-slate-700">Due to<input type="date" className={inputClass} value={filters.to} onChange={set('to')} /></label>
          <label className="text-sm text-slate-700">Category
            <select className={inputClass} value={filters.category} onChange={set('category')}>
              <option value="">All</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Owner
            <select className={inputClass} value={filters.owner} onChange={set('owner')}>
              <option value="">Everyone</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Status
            <select className={inputClass} value={filters.status} onChange={set('status')}>
              <option value="">All</option>
              <option value="on_time">Done on time</option>
              <option value="late">Done late</option>
              <option value="overdue">Overdue</option>
              <option value="open">Not due yet</option>
            </select>
          </label>
        </div>
      </Card>

      {error && <Alert>{error}</Alert>}

      {s && !error && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Due items" value={String(s.total)} />
          <Stat label="Done on time" value={String(s.on_time)} tone="emerald" />
          <Stat label="Done late" value={String(s.late)} tone="amber" />
          <Stat label="Overdue" value={String(s.overdue)} tone="red" />
          <Stat label="On-time rate" value={s.on_time_rate === null ? '—' : `${s.on_time_rate}%`}
            hint="Of items already due or done" />
        </div>
      )}

      {s && s.missing_proof > 0 && (
        <Alert kind="info">
          {s.missing_proof} completed item{s.missing_proof > 1 ? 's have' : ' has'} no proof attached. They were done before “proof required” was switched on for the obligation.
        </Alert>
      )}

      <Card className="overflow-hidden">
        {loading && !report ? (
          <div className="flex justify-center p-10 text-slate-400"><Spinner /></div>
        ) : report && report.rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Nothing was due in this period with these filters.</p>
        ) : report ? (
          <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Obligation</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Completed</th>
                  <th className="px-4 py-3 font-medium">Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((row) => (
                  <tr key={row.occurrence_id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(row.due_date)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/occurrences/${row.occurrence_id}`} className="font-medium text-slate-900 hover:text-indigo-700">{row.obligation}</Link>
                      <p className="text-xs text-slate-500">{row.category}{row.archived && ' · archived'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.owner}</td>
                    <td className="px-4 py-3"><Badge tone={REPORT_STATUS_TONE[row.status]}>{row.status_label}</Badge></td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.completed_at ? (
                        <>
                          {formatDateTime(row.completed_at)}
                          <p className="text-xs text-slate-500">{row.completed_by}{row.note && ` · “${row.note}”`}</p>
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {row.evidence.length ? (
                        <ul className="space-y-0.5">
                          {row.evidence.map((e) => (
                            <li key={e.id}><a href={`/api/evidence/${e.id}/download/`} className="text-indigo-700 hover:underline">{e.file_name}</a></li>
                          ))}
                        </ul>
                      ) : <span className="text-slate-400">{row.evidence_required ? 'none yet' : 'not required'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.truncated && <p className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600">Showing the first 1,000 items. Download the CSV for all of them.</p>}
          </div>
        ) : null}
      </Card>
    </div>
  )
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'emerald' | 'amber' | 'red'; hint?: string }) {
  const colour = tone ? { emerald: 'text-emerald-700', amber: 'text-amber-700', red: 'text-red-700' }[tone] : 'text-slate-900'
  return (
    <Card className="px-4 py-3">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${value === '0' ? 'text-slate-400' : colour}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </Card>
  )
}

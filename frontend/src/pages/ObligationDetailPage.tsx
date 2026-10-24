import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { OccurrenceList } from '../components/OccurrenceList'
import { Alert, Badge, Button, Card, FullPageSpinner } from '../components/ui'
import { api, ApiError, toFormErrors } from '../lib/api'
import { formatDate, formatDateTime } from '../lib/format'
import type { AuditEntry, ObligationDetail } from '../lib/types'

export default function ObligationDetailPage() {
  const { id } = useParams()
  const { me } = useAuth()
  const isAdmin = me?.member.role === 'admin'
  const [obligation, setObligation] = useState<ObligationDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)

  const load = useCallback(() => {
    api<ObligationDetail>(`/obligations/${id}/`)
      .then((o) => { setObligation(o); setError(null) })
      .catch((e) =>
        setError(
          e instanceof ApiError && e.status === 404
            ? 'This obligation doesn’t exist or belongs to another organization.'
            : (toFormErrors(e).general ?? 'Couldn’t load this obligation.'),
        ),
      )
  }, [id])

  useEffect(load, [load])

  async function handleArchive() {
    if (!window.confirm('Archive this obligation? Future due dates are removed; completed items and proof are kept.')) return
    setArchiving(true)
    try {
      await api(`/obligations/${id}/archive/`, 'POST')
      load()
    } catch (e) {
      setError(toFormErrors(e).general ?? 'Couldn’t archive.')
    } finally {
      setArchiving(false)
    }
  }

  if (error && !obligation) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Link to="/obligations" className="text-sm font-medium text-indigo-700 hover:underline">Back to obligations</Link>
      </div>
    )
  }
  if (!obligation) return <FullPageSpinner />

  const o = obligation
  return (
    <div className="space-y-6">
      <div>
        <Link to="/obligations" className="text-sm text-slate-500 hover:text-slate-800">← Obligations</Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{o.title}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge>{o.category_label}</Badge>
              {o.evidence_required && <Badge tone="indigo">proof required</Badge>}
              {o.archived_at && <Badge tone="amber">archived {formatDate(o.archived_at)}</Badge>}
            </div>
          </div>
          {isAdmin && !o.archived_at && (
            <div className="flex gap-2">
              <Link to={`/obligations/${o.id}/edit`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">Edit</Link>
              <Button variant="secondary" onClick={handleArchive} loading={archiving}>Archive</Button>
            </div>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card className="grid gap-4 p-5 text-sm sm:grid-cols-4">
        <Info label="Schedule" value={o.schedule} />
        <Info label="Owner" value={o.owner.name} />
        <Info label="Reminder" value={o.remind_days_before === 0 ? 'On the due date' : `${o.remind_days_before} days before`} />
        <Info label="Tracking since" value={formatDate(o.start_date)} />
        {o.description && <p className="whitespace-pre-line text-slate-700 sm:col-span-4">{o.description}</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Upcoming</h2>
          {o.upcoming.length ? <OccurrenceList items={o.upcoming} showOwner={false} /> : <p className="px-4 py-6 text-sm text-slate-500">No upcoming due dates.</p>}
        </Card>
        <Card className="overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">History</h2>
          {o.history.length ? <OccurrenceList items={o.history} showOwner={false} /> : <p className="px-4 py-6 text-sm text-slate-500">Nothing yet. Past and completed items appear here.</p>}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Audit trail</h2>
        <ol className="divide-y divide-slate-100">
          {o.audit.map((entry) => <AuditRow key={entry.id} entry={entry} />)}
        </ol>
      </Card>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  )
}

const ACTION_TEXT: Record<string, string> = {
  'obligation.created': 'created this obligation',
  'obligation.updated': 'edited',
  'obligation.archived': 'archived this obligation',
  'occurrence.completed': 'marked an item done',
  'occurrence.reopened': 'reopened an item',
  'evidence.uploaded': 'uploaded proof',
}

const FIELD_TEXT: Record<string, string> = {
  title: 'title', description: 'description', category: 'category', owner_id: 'owner', rrule: 'schedule',
  start_date: 'start date', remind_days_before: 'reminder', evidence_required: 'proof required',
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const changed = entry.action === 'obligation.updated' && entry.before && entry.after
    ? Object.keys(entry.after).filter((k) => JSON.stringify(entry.before?.[k]) !== JSON.stringify(entry.after?.[k]) && FIELD_TEXT[k])
    : []
  return (
    <li className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:justify-between">
      <p>
        <span className="font-medium">{entry.actor?.name ?? 'Someone'}</span>{' '}
        {ACTION_TEXT[entry.action] ?? entry.action}
        {changed.length > 0 && <span className="text-slate-600">: {changed.map((k) => FIELD_TEXT[k]).join(', ')}</span>}
      </p>
      <time className="shrink-0 text-slate-500" dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
    </li>
  )
}

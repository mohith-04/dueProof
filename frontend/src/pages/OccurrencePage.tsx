import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { StatusBadge } from '../components/StatusBadge'
import { Alert, Button, Card, FullPageSpinner } from '../components/ui'
import { api, ApiError, toFormErrors } from '../lib/api'
import { dueLabel, formatBytes, formatDate, formatDateTime } from '../lib/format'
import type { AuditEntry, OccurrenceDetail } from '../lib/types'

/** One due item: what to do, the proof attached, and marking it done. */
export default function OccurrencePage() {
  const { id } = useParams()
  const [item, setItem] = useState<OccurrenceDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'upload' | 'complete' | 'reopen' | number | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    api<OccurrenceDetail>(`/occurrences/${id}/`)
      .then((data) => { setItem(data); setLoadError(null) })
      .catch((e) =>
        setLoadError(e instanceof ApiError && e.status === 404 ? 'This item doesn’t exist or belongs to another organization.' : 'Couldn’t load this item.'),
      )
  }, [id])

  useEffect(load, [load])

  async function run(kind: typeof busy, action: () => Promise<unknown>) {
    setBusy(kind)
    setActionError(null)
    try {
      await action()
      load()
    } catch (e) {
      setActionError(toFormErrors(e).general ?? 'Something went wrong. Try again.')
    } finally {
      setBusy(null)
    }
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // allow choosing the same file again after an error
    if (!file || !item) return
    // Same checks as the server, so people get the answer before uploading 10 MB.
    const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
    if (!item.limits.extensions.includes(extension)) {
      setActionError(`“.${extension || '?'}” files aren't accepted. Use one of: ${item.limits.extensions.join(', ')}.`)
      return
    }
    if (file.size > item.limits.max_bytes) {
      setActionError(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(item.limits.max_bytes)}.`)
      return
    }
    const body = new FormData()
    body.append('file', file)
    run('upload', () => api(`/occurrences/${id}/evidence/`, 'POST', body))
  }

  if (loadError && !item) {
    return (
      <div className="space-y-4">
        <Alert>{loadError}</Alert>
        <Link to="/" className="text-sm font-medium text-indigo-700 hover:underline">Back to dashboard</Link>
      </div>
    )
  }
  if (!item) return <FullPageSpinner />

  const done = item.status === 'completed'
  const proofMissing = item.obligation.evidence_required && item.evidence.length === 0
  const editable = item.can_work_on && !done

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to={`/obligations/${item.obligation.id}`} className="text-sm text-slate-500 hover:text-slate-800">← {item.obligation.title}</Link>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{item.obligation.title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Due {formatDate(item.due_date)}
              {!done && <> · <span className={item.status === 'overdue' ? 'font-medium text-red-700' : ''}>{dueLabel(item.days_until_due)}</span></>}
              {' '}· Owner {item.owner.name}
            </p>
          </div>
          <StatusBadge status={item.status} />
        </div>
      </div>

      {actionError && <Alert>{actionError}</Alert>}

      {item.obligation_detail.description && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">What needs to be done</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{item.obligation_detail.description}</p>
          <p className="mt-3 text-xs text-slate-500">{item.obligation_detail.schedule}</p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold">
            Proof {item.obligation.evidence_required && <span className="font-normal text-slate-500">(required)</span>}
          </h2>
          {editable && (
            <>
              <input ref={fileInput} type="file" className="sr-only" onChange={handleFile}
                accept={item.limits.extensions.map((e) => `.${e}`).join(',')} aria-label="Upload proof file" />
              <Button variant="secondary" loading={busy === 'upload'} onClick={() => fileInput.current?.click()}>Upload file</Button>
            </>
          )}
        </div>
        {item.evidence.length ? (
          <ul className="divide-y divide-slate-100">
            {item.evidence.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <a href={file.download_url} className="block truncate font-medium text-indigo-700 hover:underline">{file.file_name}</a>
                  <p className="text-slate-500">
                    {formatBytes(file.size_bytes)} · {file.uploaded_by?.name ?? 'Someone'} · {formatDateTime(file.uploaded_at)}
                  </p>
                </div>
                {editable && (
                  <Button variant="ghost" loading={busy === file.id}
                    onClick={() => window.confirm(`Remove “${file.file_name}”?`) && run(file.id, () => api(`/evidence/${file.id}/`, 'DELETE'))}>
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-slate-500">
            No files yet.{' '}
            {editable && `Attach the receipt, report or screenshot that proves this was done (${item.limits.extensions.join(', ')}, up to ${formatBytes(item.limits.max_bytes)}).`}
          </p>
        )}
      </Card>

      {done ? (
        <Card className="border-emerald-200 bg-emerald-50/60 p-5">
          <p className="font-medium text-emerald-900">
            Done by {item.completed_by?.name ?? 'someone'} on {item.completed_at && formatDateTime(item.completed_at)}
          </p>
          {item.completion_note && <p className="mt-2 whitespace-pre-line text-sm text-emerald-900">“{item.completion_note}”</p>}
          {item.can_reopen && (
            <Button variant="secondary" className="mt-4" loading={busy === 'reopen'}
              onClick={() => {
                const reason = window.prompt('Why reopen this item? (saved in the audit trail)')
                if (reason !== null) run('reopen', () => api(`/occurrences/${id}/reopen/`, 'POST', { reason }))
              }}>
              Reopen
            </Button>
          )}
        </Card>
      ) : item.can_work_on ? (
        <Card className="p-5">
          <label htmlFor="note" className="block text-sm font-semibold">Mark as done</label>
          <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note, e.g. reference number or what was checked"
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">{proofMissing ? 'Upload proof first. This obligation requires it.' : 'Proof and note are saved with the record.'}</p>
            <Button disabled={proofMissing} loading={busy === 'complete'}
              onClick={() => run('complete', () => api(`/occurrences/${id}/complete/`, 'POST', { note }).then(() => setNote('')))}>
              Mark as done
            </Button>
          </div>
        </Card>
      ) : (
        <Alert kind="info">Only {item.owner.name} (the owner) or an admin can upload proof and mark this done.</Alert>
      )}

      {item.activity.length > 0 && (
        <Card className="overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Activity</h2>
          <ol className="divide-y divide-slate-100">
            {item.activity.map((entry) => <ActivityRow key={entry.id} entry={entry} />)}
          </ol>
        </Card>
      )}
    </div>
  )
}

function ActivityRow({ entry }: { entry: AuditEntry }) {
  const file = (entry.after?.file_name ?? entry.before?.file_name) as string | undefined
  const text: Record<string, string> = {
    'evidence.uploaded': `uploaded ${file}`,
    'evidence.removed': `removed ${file}`,
    'occurrence.completed': 'marked this done',
    'occurrence.reopened': `reopened this${entry.after?.reason ? `: “${entry.after.reason}”` : ''}`,
  }
  return (
    <li className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:justify-between">
      <p><span className="font-medium">{entry.actor?.name ?? 'Someone'}</span> {text[entry.action] ?? entry.action}</p>
      <time className="shrink-0 text-slate-500" dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
    </li>
  )
}

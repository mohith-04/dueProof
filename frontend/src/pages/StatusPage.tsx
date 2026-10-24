import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'

type Health = { status: string; database: string }

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; health: Health }
  | { kind: 'error'; message: string }

/**
 * First page: proves the full chain works (React → /api proxy → Django → database).
 * It will be replaced by the dashboard once login exists.
 */
export default function StatusPage() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    api<Health>('/health/')
      .then((health) => setState({ kind: 'ok', health }))
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? `The API answered with status ${error.status}.`
            : 'Could not reach the API. Is the Django server running on port 8000?'
        setState({ kind: 'error', message })
      })
  }, [])

  return (
    <section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">System status</h1>
      <p className="mt-1 text-sm text-slate-600">Checks that the app, API and database are connected.</p>

      <div className="mt-6" aria-live="polite">
        {state.kind === 'loading' && <p className="text-slate-500">Checking…</p>}

        {state.kind === 'ok' && (
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">API</dt>
            <dd className="font-medium text-emerald-700">{state.health.status}</dd>
            <dt className="text-slate-500">Database</dt>
            <dd className="font-medium text-emerald-700">{state.health.database}</dd>
          </dl>
        )}

        {state.kind === 'error' && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {state.message}
          </p>
        )}
      </div>
    </section>
  )
}

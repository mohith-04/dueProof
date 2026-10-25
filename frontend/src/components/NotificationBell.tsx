import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { api, DATA_CHANGED_EVENT } from '../lib/api'
import { formatDateTime } from '../lib/format'
import type { NotificationFeed, NotificationItem } from '../lib/notifications'

const REFRESH_MS = 60_000

/**
 * Bell in the top bar. Asking the API for notifications also creates any that
 * became due (no scheduler), so it refreshes on every page change and once a minute.
 */
export function NotificationBell() {
  const [feed, setFeed] = useState<NotificationFeed | null>(null)
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()

  const refresh = useCallback(() => {
    api<NotificationFeed>('/notifications/').then(setFeed).catch(() => {
      /* the bell is optional: keep the last good state if a refresh fails */
    })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, location.pathname])

  useEffect(() => {
    const timer = setInterval(refresh, REFRESH_MS)
    // Refresh right after the user changes something, e.g. marks an item done.
    const onChange = () => setTimeout(refresh, 0)
    window.addEventListener(DATA_CHANGED_EVENT, onChange)
    return () => {
      clearInterval(timer)
      window.removeEventListener(DATA_CHANGED_EVENT, onChange)
    }
  }, [refresh])

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function openItem(item: NotificationItem) {
    setOpen(false)
    if (!item.read) await api(`/notifications/${item.id}/read/`, 'POST').catch(() => undefined)
    navigate(`/occurrences/${item.occurrence_id}`)
    refresh()
  }

  async function markAllRead() {
    await api('/notifications/read-all/', 'POST').catch(() => undefined)
    refresh()
  }

  const unread = feed?.unread_count ?? 0

  return (
    <div className="relative" ref={panel}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-sm font-medium text-indigo-700 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {feed && feed.items.length > 0 ? (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {feed.items.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => openItem(item)}
                    className={`flex w-full gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 ${item.read || item.resolved ? 'text-slate-500' : 'text-slate-900'}`}>
                    <span aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.resolved ? 'bg-emerald-500' : item.read ? 'bg-transparent' : item.kind === 'overdue' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <span>
                      <span className={item.read || item.resolved ? '' : 'font-medium'}>{item.message}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{formatDateTime(item.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              You're all caught up. Reminders appear here when your items are due soon or overdue.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

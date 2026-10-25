import { Link } from 'react-router'
import { dueLabel, formatDate } from '../lib/format'
import type { OccurrenceItem } from '../lib/types'
import { StatusBadge } from './StatusBadge'

/** A list of due items: what, who, when, and whether proof is attached. */
export function OccurrenceList({ items, showOwner = true }: { items: OccurrenceItem[]; showOwner?: boolean }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to={`/occurrences/${item.id}`}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{item.obligation.title}</p>
              <p className="text-sm text-slate-500">
                {item.obligation.category_label}
                {showOwner && <> · {item.owner.name}</>}
                {item.obligation.evidence_required && item.status !== 'completed' && <> · proof required</>}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              {item.status === 'completed' ? (
                <span className="text-slate-500">
                  Done {item.completed_at && formatDate(item.completed_at)}
                  {item.evidence_count > 0 && ` · ${item.evidence_count} file${item.evidence_count > 1 ? 's' : ''}`}
                </span>
              ) : (
                <span className={item.status === 'overdue' ? 'font-medium text-red-700' : 'text-slate-600'}>
                  {dueLabel(item.days_until_due)} · {formatDate(item.due_date)}
                </span>
              )}
              <StatusBadge status={item.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

import type { Category, OccurrenceStatus } from './types'

/** "2026-11-20" → "20 Nov 2026". Dates are calendar days, so no timezone shifting. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

/** Full timestamps (completed at, audit entries) in the viewer's local time. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function dueLabel(daysUntilDue: number): string {
  if (daysUntilDue === 0) return 'Due today'
  if (daysUntilDue === 1) return 'Due tomorrow'
  if (daysUntilDue > 1) return `Due in ${daysUntilDue} days`
  if (daysUntilDue === -1) return '1 day overdue'
  return `${-daysUntilDue} days overdue`
}

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'finance', label: 'Finance & tax' },
  { value: 'security', label: 'IT & security' },
  { value: 'hr', label: 'HR & people' },
  { value: 'legal', label: 'Legal & licences' },
  { value: 'operations', label: 'Operations & safety' },
  { value: 'other', label: 'Other' },
]

export const STATUS_LABEL: Record<OccurrenceStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  upcoming: 'Upcoming',
  completed: 'Completed',
}

export const STATUS_TONE: Record<OccurrenceStatus, 'red' | 'amber' | 'slate' | 'emerald'> = {
  overdue: 'red',
  due_soon: 'amber',
  upcoming: 'slate',
  completed: 'emerald',
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

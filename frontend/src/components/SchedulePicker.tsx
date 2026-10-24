import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { MONTHS, toRrule, type Frequency, type ScheduleChoice } from '../lib/schedule'

type Preview = { schedule: string; next_dates: string[] }

const selectClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'

/** Simple choices in, RRULE out, with a live "next due" preview from the API. */
export function SchedulePicker({ value, onChange, startDate, error }: {
  value: ScheduleChoice
  onChange: (next: ScheduleChoice) => void
  startDate: string
  error?: string
}) {
  const set = <K extends keyof ScheduleChoice>(key: K, v: ScheduleChoice[K]) => onChange({ ...value, [key]: v })
  const rule = toRrule(value)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (!rule || !startDate) return
    let cancelled = false
    const timer = setTimeout(() => {
      api<Preview>('/obligations/preview/', 'POST', { rrule: rule, start_date: startDate })
        .then((p) => { if (!cancelled) { setPreview(p); setPreviewError(null) } })
        .catch(() => { if (!cancelled) { setPreview(null); setPreviewError('This schedule isn’t valid yet.') } })
    }, 300) // wait until the user stops typing
    return () => { cancelled = true; clearTimeout(timer) }
  }, [rule, startDate])

  const dayOptions = (
    <>
      {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      <option value={-1}>Last day of the month</option>
    </>
  )

  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-medium text-slate-700">Schedule</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm text-slate-700">
          Repeats
          <select className={selectClass} value={value.frequency} onChange={(e) => set('frequency', e.target.value as Frequency)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="half_yearly">Twice a year</option>
            <option value="yearly">Yearly</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom rule (advanced)</option>
          </select>
        </label>

        {value.frequency === 'quarterly' && (
          <label className="block text-sm text-slate-700">
            In the months
            <select className={selectClass} value={value.quarterMonths} onChange={(e) => set('quarterMonths', e.target.value as 'ends' | 'starts')}>
              <option value="ends">Mar, Jun, Sep, Dec</option>
              <option value="starts">Jan, Apr, Jul, Oct</option>
            </select>
          </label>
        )}
        {value.frequency === 'half_yearly' && (
          <label className="block text-sm text-slate-700">
            In the months
            <select className={selectClass} value={value.months} onChange={(e) => set('months', e.target.value)}>
              {Array.from({ length: 6 }, (_, i) => (
                <option key={i} value={`${i + 1},${i + 7}`}>{MONTHS[i].slice(0, 3)} and {MONTHS[i + 6].slice(0, 3)}</option>
              ))}
            </select>
          </label>
        )}
        {value.frequency === 'yearly' && (
          <label className="block text-sm text-slate-700">
            Month
            <select className={selectClass} value={value.months.split(',')[0]} onChange={(e) => set('months', e.target.value)}>
              {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
            </select>
          </label>
        )}
        {['monthly', 'quarterly', 'half_yearly', 'yearly'].includes(value.frequency) && (
          <label className="block text-sm text-slate-700">
            On day
            <select className={selectClass} value={value.day} onChange={(e) => set('day', Number(e.target.value))}>
              {dayOptions}
            </select>
          </label>
        )}
        {value.frequency === 'weekly' && (
          <label className="block text-sm text-slate-700">
            On
            <select className={selectClass} value={value.weekday} onChange={(e) => set('weekday', e.target.value as ScheduleChoice['weekday'])}>
              {[['MO', 'Monday'], ['TU', 'Tuesday'], ['WE', 'Wednesday'], ['TH', 'Thursday'], ['FR', 'Friday']].map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
        )}
        {value.frequency === 'custom' && (
          <label className="block text-sm text-slate-700 sm:col-span-2">
            RRULE
            <input className={`${selectClass} font-mono`} value={value.custom} placeholder="FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=10"
              onChange={(e) => set('custom', e.target.value)} />
          </label>
        )}
      </div>

      {value.day > 28 && ['monthly', 'quarterly', 'half_yearly'].includes(value.frequency) && (
        <p className="mt-3 text-sm text-amber-800">
          Months without day {value.day} are skipped. Choose “Last day of the month” to cover every month.
        </p>
      )}

      <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm" aria-live="polite">
        {error || previewError ? (
          <p className="text-red-600">{error || previewError}</p>
        ) : preview ? (
          <>
            <p className="font-medium text-slate-800">{preview.schedule}</p>
            <p className="mt-0.5 text-slate-600">
              Next due: {preview.next_dates.length ? preview.next_dates.slice(0, 4).map(formatDate).join(' · ') : 'none in the next 5 years'}
            </p>
          </>
        ) : (
          <p className="text-slate-500">Choose a schedule to see the next due dates.</p>
        )}
      </div>
    </fieldset>
  )
}

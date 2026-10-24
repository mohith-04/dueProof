/**
 * The schedule picker in the form works with simple choices ("monthly on the 20th",
 * "quarterly on the last day"). These functions convert those choices to the RRULE
 * string the API stores, and back again when editing.
 */

export type Frequency = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'weekly' | 'custom'

export type ScheduleChoice = {
  frequency: Frequency
  /** 1–31, or -1 for "last day of the month". */
  day: number
  /** Quarterly: which months the quarter's due date falls in. */
  quarterMonths: 'ends' | 'starts'
  /** Half-yearly: the two months, e.g. "1,7". Yearly: one month "1".."12". */
  months: string
  weekday: 'MO' | 'TU' | 'WE' | 'TH' | 'FR'
  /** Advanced: a raw RRULE for anything the simple choices can't express. */
  custom: string
}

export const DEFAULT_SCHEDULE: ScheduleChoice = {
  frequency: 'monthly',
  day: 20,
  quarterMonths: 'ends',
  months: '1',
  weekday: 'MO',
  custom: '',
}

const QUARTER_MONTHS = { ends: '3,6,9,12', starts: '1,4,7,10' } as const

export function toRrule(s: ScheduleChoice): string {
  const day = `BYMONTHDAY=${s.day}`
  switch (s.frequency) {
    case 'monthly':
      return `FREQ=MONTHLY;${day}`
    case 'quarterly':
      return `FREQ=MONTHLY;BYMONTH=${QUARTER_MONTHS[s.quarterMonths]};${day}`
    case 'half_yearly':
      return `FREQ=MONTHLY;BYMONTH=${s.months};${day}`
    case 'yearly':
      return `FREQ=YEARLY;BYMONTH=${s.months};${day}`
    case 'weekly':
      return `FREQ=WEEKLY;BYDAY=${s.weekday}`
    case 'custom':
      return s.custom.trim().toUpperCase()
  }
}

/** Best-effort reverse of toRrule; anything unrecognised opens as "custom". */
export function fromRrule(rule: string, startDate: string): ScheduleChoice {
  const parts = Object.fromEntries(
    rule.toUpperCase().replace(/^RRULE:/, '').split(';').map((p) => p.split('=') as [string, string]),
  )
  const keys = Object.keys(parts).sort().join(',')
  const startDay = Number(startDate.slice(8, 10)) || 1
  const startMonth = String(Number(startDate.slice(5, 7)) || 1)
  const day = parts.BYMONTHDAY ? Number(parts.BYMONTHDAY) : startDay
  const base = { ...DEFAULT_SCHEDULE, custom: rule }

  if (parts.FREQ === 'MONTHLY' && keys === 'BYMONTHDAY,FREQ') return { ...base, frequency: 'monthly', day }
  if (parts.FREQ === 'MONTHLY' && keys === 'BYMONTH,BYMONTHDAY,FREQ') {
    if (parts.BYMONTH === QUARTER_MONTHS.ends) return { ...base, frequency: 'quarterly', quarterMonths: 'ends', day }
    if (parts.BYMONTH === QUARTER_MONTHS.starts) return { ...base, frequency: 'quarterly', quarterMonths: 'starts', day }
    if (parts.BYMONTH.split(',').length === 2) return { ...base, frequency: 'half_yearly', months: parts.BYMONTH, day }
  }
  if (parts.FREQ === 'YEARLY' && (keys === 'BYMONTH,BYMONTHDAY,FREQ' || keys === 'FREQ')) {
    return { ...base, frequency: 'yearly', months: parts.BYMONTH ?? startMonth, day }
  }
  if (parts.FREQ === 'WEEKLY' && keys === 'BYDAY,FREQ' && /^(MO|TU|WE|TH|FR)$/.test(parts.BYDAY)) {
    return { ...base, frequency: 'weekly', weekday: parts.BYDAY as ScheduleChoice['weekday'] }
  }
  return { ...base, frequency: 'custom' }
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

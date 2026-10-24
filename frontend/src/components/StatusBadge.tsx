import { STATUS_LABEL, STATUS_TONE } from '../lib/format'
import type { OccurrenceStatus } from '../lib/types'
import { Badge } from './ui'

export function StatusBadge({ status }: { status: OccurrenceStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}

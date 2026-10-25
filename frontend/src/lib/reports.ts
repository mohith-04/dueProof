export type ReportStatus = 'on_time' | 'late' | 'overdue' | 'open'

export type ReportRow = {
  occurrence_id: number
  obligation_id: number
  obligation: string
  category: string
  owner: string
  archived: boolean
  due_date: string
  status: ReportStatus
  status_label: string
  completed_at: string | null
  completed_by: string | null
  note: string
  evidence_required: boolean
  evidence: { id: number; file_name: string; uploaded_by: string | null; uploaded_at: string }[]
}

export type Report = {
  filters: { from: string; to: string; category: string; owner: number | null; status: string }
  today: string
  summary: {
    total: number
    on_time: number
    late: number
    overdue: number
    open: number
    done: number
    on_time_rate: number | null
    missing_proof: number
  }
  rows: ReportRow[]
  truncated: boolean
}

export const REPORT_STATUS_TONE: Record<ReportStatus, 'emerald' | 'amber' | 'red' | 'slate'> = {
  on_time: 'emerald',
  late: 'amber',
  overdue: 'red',
  open: 'slate',
}

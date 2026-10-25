export type Role = 'admin' | 'member'

export type Member = {
  id: number
  name: string
  email: string
  role: Role
}

export type Organization = {
  id: number
  name: string
  timezone: string
}

/** Response of /api/auth/me/, /login/, /signup/ and invite acceptance. */
export type Me = {
  member: Member
  org: Organization
}

export type Invite = {
  id: number
  email: string
  role: Role
  expires_at: string
  accepted_at: string | null
  is_valid: boolean
  created_at: string
  /** Only present right after creation: the one-time link path, e.g. /invite/abc123. */
  invite_path?: string
}

export type Category = 'finance' | 'security' | 'hr' | 'legal' | 'operations' | 'other'

export type Person = { id: number; name: string }

export type Obligation = {
  id: number
  title: string
  description: string
  category: Category
  category_label: string
  owner: Person
  rrule: string
  schedule: string
  start_date: string
  remind_days_before: number
  evidence_required: boolean
  archived_at: string | null
  next_due: string | null
  created_at: string
  updated_at: string
}

export type OccurrenceStatus = 'overdue' | 'due_soon' | 'upcoming' | 'completed'

export type OccurrenceItem = {
  id: number
  due_date: string
  status: OccurrenceStatus
  days_until_due: number
  obligation: { id: number; title: string; category: Category; category_label: string; evidence_required: boolean }
  owner: Person
  evidence_count: number
  completed_at: string | null
  completed_by: Person | null
  completion_note: string
}

export type AuditEntry = {
  id: number
  action: string
  entity_type: string
  entity_id: number
  actor: Person | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  created_at: string
}

export type ObligationDetail = Obligation & {
  upcoming: OccurrenceItem[]
  history: OccurrenceItem[]
  audit: AuditEntry[]
}

export type Dashboard = {
  today: string
  counts: { overdue: number; due_soon: number; upcoming: number; completed_last_30_days: number; active_obligations: number }
  overdue: OccurrenceItem[]
  due_soon: OccurrenceItem[]
  upcoming: OccurrenceItem[]
  recently_completed: OccurrenceItem[]
}

export type ObligationTemplate = {
  key: string
  title: string
  category: Category
  description: string
  rrule: string
  remind_days_before: number
  evidence_required: boolean
}

export type EvidenceFile = {
  id: number
  file_name: string
  content_type: string
  size_bytes: number
  uploaded_by: Person | null
  uploaded_at: string
  download_url: string
}

export type OccurrenceDetail = OccurrenceItem & {
  obligation_detail: { description: string; schedule: string; archived: boolean }
  evidence: EvidenceFile[]
  activity: AuditEntry[]
  can_work_on: boolean
  can_reopen: boolean
  limits: { max_bytes: number; extensions: string[] }
}

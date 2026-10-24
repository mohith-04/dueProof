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

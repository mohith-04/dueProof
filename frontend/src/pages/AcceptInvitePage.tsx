import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Field, FullPageSpinner } from '../components/ui'
import { api, toFormErrors, type FormErrors } from '../lib/api'
import type { Me, Role } from '../lib/types'

type InviteInfo = { org_name: string; email: string; role: Role }

export default function AcceptInvitePage() {
  const { token = '' } = useParams()
  const { me, setMe } = useAuth()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({ fields: {} })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api<InviteInfo>(`/auth/invites/${encodeURIComponent(token)}/`)
      .then(setInvite)
      .catch(() => setInvalid(true))
  }, [token])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setErrors({ fields: {} })
    try {
      const joined = await api<Me>(`/auth/invites/${encodeURIComponent(token)}/accept/`, 'POST', { name, password })
      setMe(joined)
      navigate('/', { replace: true })
    } catch (error) {
      setErrors(toFormErrors(error))
      setSubmitting(false)
    }
  }

  if (me) {
    return (
      <AuthShell title="You're already logged in">
        <Alert kind="info">
          Log out first to accept this invite as a new person (or open the link in a private window).
        </Alert>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-indigo-700 hover:underline">
          Go to dashboard
        </Link>
      </AuthShell>
    )
  }
  if (invalid) {
    return (
      <AuthShell title="Invite not valid">
        <Alert>This invite link has expired or was already used. Ask your admin for a new one.</Alert>
      </AuthShell>
    )
  }
  if (!invite) return <FullPageSpinner />

  return (
    <AuthShell title={`Join ${invite.org_name}`} subtitle={`You've been invited as ${invite.role === 'admin' ? 'an admin' : 'a member'}.`}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errors.general && <Alert>{errors.general}</Alert>}
        <Field label="Email" type="email" value={invite.email} disabled readOnly />
        <Field label="Your name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)}
          error={errors.fields.name} />
        <Field label="Choose a password" type="password" autoComplete="new-password" required value={password}
          onChange={(e) => setPassword(e.target.value)} error={errors.fields.password}
          hint="At least 8 characters, not a common password." />
        <Button type="submit" loading={submitting} className="w-full">
          Join organization
        </Button>
      </form>
    </AuthShell>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { Alert, Badge, Button, Card, Field, SelectField, Spinner } from '../components/ui'
import { api, toFormErrors, type FormErrors } from '../lib/api'
import type { Invite, Member, Role } from '../lib/types'

/** Members of the org; admins can invite people by sharing a one-time link (no email service needed). */
export default function TeamPage() {
  const { me } = useAuth()
  const isAdmin = me?.member.role === 'admin'
  const [members, setMembers] = useState<Member[] | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(() => {
    const requests: Promise<unknown>[] = [api<Member[]>('/org/members/').then(setMembers)]
    if (isAdmin) requests.push(api<Invite[]>('/org/invites/').then(setInvites))
    Promise.all(requests)
      .then(() => setLoadError(false))
      .catch(() => setLoadError(true))
  }, [isAdmin])

  useEffect(load, [load])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="mt-1 text-sm text-slate-600">Everyone here can be made the owner of an obligation.</p>
      </div>

      {loadError && <Alert>Couldn't load the team. Refresh the page to try again.</Alert>}

      {isAdmin && <InviteForm onCreated={load} />}

      <Card>
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Members</h2>
        {members === null && !loadError ? (
          <div className="flex justify-center p-6 text-slate-400"><Spinner /></div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members?.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{m.name}{m.id === me?.member.id && <span className="text-slate-500"> (you)</span>}</p>
                  <p className="text-slate-500">{m.email}</p>
                </div>
                <Badge tone={m.role === 'admin' ? 'indigo' : 'slate'}>{m.role}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isAdmin && invites.length > 0 && (
        <Card>
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Invites</h2>
          <ul className="divide-y divide-slate-100">
            {invites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-slate-500">
                    {invite.accepted_at
                      ? `Joined ${new Date(invite.accepted_at).toLocaleDateString()}`
                      : invite.is_valid
                        ? `Expires ${new Date(invite.expires_at).toLocaleDateString()}`
                        : 'Expired'}
                  </p>
                </div>
                <Badge tone={invite.accepted_at ? 'emerald' : invite.is_valid ? 'amber' : 'slate'}>
                  {invite.accepted_at ? 'accepted' : invite.is_valid ? 'pending' : 'expired'}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function InviteForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [errors, setErrors] = useState<FormErrors>({ fields: {} })
  const [submitting, setSubmitting] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setErrors({ fields: {} })
    setLink(null)
    try {
      const invite = await api<Invite>('/org/invites/', 'POST', { email, role })
      setLink(invite.invite_path ? `${window.location.origin}${invite.invite_path}` : null)
      setCopied(false)
      setEmail('')
      onCreated()
    } catch (error) {
      setErrors(toFormErrors(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
  }

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold">Invite someone</h2>
      <p className="mt-1 text-sm text-slate-600">
        You'll get a one-time link to send them on WhatsApp, Slack or email. It works once and expires in 7 days.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
        <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          error={errors.fields.email} className="flex-1" />
        <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="sm:w-36">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </SelectField>
        <Button type="submit" loading={submitting}>Create invite link</Button>
      </form>
      {errors.general && <div className="mt-3"><Alert>{errors.general}</Alert></div>}
      {link && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-900">Invite link ready. It's shown only once, so copy it now.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.target.select()}
              className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs" />
            <Button type="button" variant="secondary" onClick={copyLink}>{copied ? 'Copied' : 'Copy link'}</Button>
          </div>
        </div>
      )}
    </Card>
  )
}

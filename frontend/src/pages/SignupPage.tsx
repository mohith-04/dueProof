import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Field, SelectField } from '../components/ui'
import { api, toFormErrors, type FormErrors } from '../lib/api'
import type { Me } from '../lib/types'

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
}

export default function SignupPage() {
  const { setMe } = useAuth()
  const navigate = useNavigate()
  const timezones = useMemo(() => Intl.supportedValuesOf('timeZone'), [])
  const [form, setForm] = useState({ name: '', email: '', password: '', org_name: '', timezone: browserTimezone() })
  const [errors, setErrors] = useState<FormErrors>({ fields: {} })
  const [submitting, setSubmitting] = useState(false)

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [field]: e.target.value }))

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setErrors({ fields: {} })
    try {
      const me = await api<Me>('/auth/signup/', 'POST', form)
      setMe(me)
      navigate('/', { replace: true })
    } catch (error) {
      setErrors(toFormErrors(error))
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Create your organization" subtitle="You'll be its admin and can invite your team next.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errors.general && <Alert>{errors.general}</Alert>}
        <Field label="Organization name" required value={form.org_name} onChange={update('org_name')}
          error={errors.fields.org_name} placeholder="Acme Labs" />
        <Field label="Your name" autoComplete="name" required value={form.name} onChange={update('name')}
          error={errors.fields.name} />
        <Field label="Work email" type="email" autoComplete="email" required value={form.email}
          onChange={update('email')} error={errors.fields.email} />
        <Field label="Password" type="password" autoComplete="new-password" required value={form.password}
          onChange={update('password')} error={errors.fields.password} hint="At least 8 characters, not a common password." />
        <SelectField label="Timezone" value={form.timezone} onChange={update('timezone')} error={errors.fields.timezone}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </SelectField>
        <p className="-mt-2 text-xs text-slate-500">Due dates and "today" are calculated in this timezone.</p>
        <Button type="submit" loading={submitting} className="w-full">
          Create organization
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-indigo-700 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  )
}

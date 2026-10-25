import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Field } from '../components/ui'
import { api, toFormErrors, type FormErrors } from '../lib/api'
import type { Me } from '../lib/types'
import { useTitle } from '../lib/useTitle'

/** Only allow redirects to our own pages after login (never to another site). */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export default function LoginPage() {
  useTitle('Log in')
  const { setMe } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({ fields: {} })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setErrors({ fields: {} })
    try {
      const me = await api<Me>('/auth/login/', 'POST', { email, password })
      setMe(me)
      navigate(safeNext(params.get('next')), { replace: true })
    } catch (error) {
      setErrors(toFormErrors(error))
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Log in" subtitle="Welcome back.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errors.general && <Alert>{errors.general}</Alert>}
        <Field label="Email" type="email" autoComplete="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} error={errors.fields.email} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password}
          onChange={(e) => setPassword(e.target.value)} error={errors.fields.password} />
        <Button type="submit" loading={submitting} className="w-full">
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        New team?{' '}
        <Link to="/signup" className="font-medium text-indigo-700 hover:underline">
          Create an organization
        </Link>
      </p>
    </AuthShell>
  )
}

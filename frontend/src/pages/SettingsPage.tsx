import { useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { Alert, Button, Card, Field, SelectField } from '../components/ui'
import { api, toFormErrors, type FormErrors } from '../lib/api'
import type { Organization } from '../lib/types'
import { useTitle } from '../lib/useTitle'

export default function SettingsPage() {
  useTitle('Settings')
  const { me, setMe } = useAuth()
  const isAdmin = me?.member.role === 'admin'
  const timezones = useMemo(() => Intl.supportedValuesOf('timeZone'), [])
  const [name, setName] = useState(me?.org.name ?? '')
  const [timezone, setTimezone] = useState(me?.org.timezone ?? 'Asia/Kolkata')
  const [errors, setErrors] = useState<FormErrors>({ fields: {} })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!me) return null
  const changed = name !== me.org.name || timezone !== me.org.timezone

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!me) return
    setSaving(true)
    setSaved(false)
    setErrors({ fields: {} })
    try {
      const org = await api<Organization>('/org/', 'PATCH', { name, timezone })
      setMe({ ...me, org })
      setSaved(true)
    } catch (error) {
      setErrors(toFormErrors(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization settings</h1>
        <p className="mt-1 text-sm text-slate-600">{isAdmin ? 'Only admins can change these.' : 'Ask an admin to change these.'}</p>
      </div>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {errors.general && <Alert>{errors.general}</Alert>}
          {saved && <Alert kind="success">Saved.</Alert>}
          <Field label="Organization name" value={name} disabled={!isAdmin} onChange={(e) => { setName(e.target.value); setSaved(false) }}
            error={errors.fields.name} />
          <SelectField label="Timezone" value={timezone} disabled={!isAdmin} onChange={(e) => { setTimezone(e.target.value); setSaved(false) }}
            error={errors.fields.timezone}>
            {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </SelectField>
          <p className="-mt-3 text-sm text-slate-600">
            “Today”, due soon and overdue are all worked out in this timezone. Existing due dates stay on the same calendar day.
          </p>
          {isAdmin && (
            <div className="flex justify-end border-t border-slate-200 pt-5">
              <Button type="submit" loading={saving} disabled={!changed}>Save changes</Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  )
}

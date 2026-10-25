import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { SchedulePicker } from '../components/SchedulePicker'
import { Alert, Button, Card, Field, FullPageSpinner, SelectField } from '../components/ui'
import { api, toFormErrors, type FormErrors } from '../lib/api'
import { CATEGORIES } from '../lib/format'
import { DEFAULT_SCHEDULE, fromRrule, toRrule, type ScheduleChoice } from '../lib/schedule'
import type { Category, Member, Obligation, ObligationTemplate } from '../lib/types'
import { useTitle } from '../lib/useTitle'

type FormState = {
  title: string
  description: string
  category: Category
  owner_id: string
  start_date: string
  remind_days_before: string
  evidence_required: boolean
  schedule: ScheduleChoice
}

function todayIso(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const EMPTY: FormState = {
  title: '', description: '', category: 'other', owner_id: '', start_date: todayIso(),
  remind_days_before: '7', evidence_required: true, schedule: DEFAULT_SCHEDULE,
}

/** Create (/obligations/new) and edit (/obligations/:id/edit). Admins only; the API enforces it too. */
export default function ObligationFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  useTitle(isEdit ? 'Edit obligation' : 'New obligation')
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [members, setMembers] = useState<Member[]>([])
  const [templates, setTemplates] = useState<ObligationTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<FormErrors>({ fields: {} })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const requests: Promise<unknown>[] = [api<Member[]>('/org/members/').then(setMembers)]
    if (isEdit) {
      requests.push(api<Obligation>(`/obligations/${id}/`).then((o) => setForm({
        title: o.title, description: o.description, category: o.category, owner_id: String(o.owner.id),
        start_date: o.start_date, remind_days_before: String(o.remind_days_before), evidence_required: o.evidence_required,
        schedule: fromRrule(o.rrule, o.start_date),
      })))
    } else {
      requests.push(api<ObligationTemplate[]>('/obligation-templates/').then(setTemplates))
    }
    Promise.all(requests)
      .catch(() => setErrors({ general: 'Couldn’t load the form. Refresh to try again.', fields: {} }))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  function applyTemplate(t: ObligationTemplate) {
    setForm((f) => ({
      ...f, title: t.title, description: t.description, category: t.category,
      remind_days_before: String(t.remind_days_before), evidence_required: t.evidence_required,
      schedule: fromRrule(t.rrule, f.start_date),
    }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setErrors({ fields: {} })
    const body = {
      title: form.title, description: form.description, category: form.category,
      owner_id: form.owner_id ? Number(form.owner_id) : null, start_date: form.start_date,
      remind_days_before: Number(form.remind_days_before), evidence_required: form.evidence_required,
      rrule: toRrule(form.schedule),
    }
    try {
      const saved = await api<Obligation>(isEdit ? `/obligations/${id}/` : '/obligations/', isEdit ? 'PATCH' : 'POST', body)
      navigate(`/obligations/${saved.id}`)
    } catch (error) {
      setErrors(toFormErrors(error))
      setSaving(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (loading) return <FullPageSpinner />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to={isEdit ? `/obligations/${id}` : '/obligations'} className="text-sm text-slate-500 hover:text-slate-800">← Back</Link>
        <h1 className="mt-2 text-2xl font-semibold">{isEdit ? 'Edit obligation' : 'New obligation'}</h1>
        {isEdit && (
          <p className="mt-1 text-sm text-slate-600">Changing the schedule only moves future, open due dates. Completed items and their proof stay as they are.</p>
        )}
      </div>

      {!isEdit && templates.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Start from a template</h2>
          <p className="mt-1 text-xs text-slate-500">Examples to edit, not legal advice. Check dates against your own deadlines.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {templates.map((t) => (
              <button key={t.key} type="button" onClick={() => applyTemplate(t)}
                className={`rounded-full border px-3 py-1.5 text-sm ${form.title === t.title ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-300 bg-white hover:border-slate-400'}`}>
                {t.title}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {errors.general && <Alert>{errors.general}</Alert>}
          <Field label="Title" required value={form.title} onChange={(e) => set('title', e.target.value)}
            error={errors.fields.title} placeholder="Quarterly access review" />
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700">What needs to be done</label>
            <textarea id="description" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Category" value={form.category} onChange={(e) => set('category', e.target.value as Category)} error={errors.fields.category}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </SelectField>
            <SelectField label="Owner" value={form.owner_id} onChange={(e) => set('owner_id', e.target.value)} error={errors.fields.owner_id}>
              <option value="">Choose who is responsible…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </SelectField>
          </div>

          <SchedulePicker value={form.schedule} onChange={(s) => set('schedule', s)} startDate={form.start_date} error={errors.fields.rrule} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start tracking from" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)}
              error={errors.fields.start_date} hint="Due dates before today are never created." />
            <Field label="Remind the owner (days before)" type="number" min={0} max={365} value={form.remind_days_before}
              onChange={(e) => set('remind_days_before', e.target.value)} error={errors.fields.remind_days_before} />
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
            <input type="checkbox" checked={form.evidence_required} onChange={(e) => set('evidence_required', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600" />
            <span>
              <span className="font-medium text-slate-800">Proof required</span>
              <span className="block text-slate-600">An item can only be marked done once a file (receipt, report, screenshot) is attached.</span>
            </span>
          </label>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <Link to={isEdit ? `/obligations/${id}` : '/obligations'} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</Link>
            <Button type="submit" loading={saving}>{isEdit ? 'Save changes' : 'Create obligation'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

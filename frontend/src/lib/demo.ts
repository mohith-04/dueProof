/** The public demo account created by `python manage.py seed_demo` (see README). */
export const DEMO_ACCOUNT = {
  email: 'admin@dueproof.demo',
  password: 'DueProof-Demo-2026',
}

export const DEMO_LOGINS = [
  { email: 'admin@dueproof.demo', role: 'Admin', who: 'Asha, who runs compliance. Sees everything, creates obligations.' },
  { email: 'ravi@dueproof.demo', role: 'Member', who: 'Ravi, who files the taxes. One of his returns is overdue.' },
  { email: 'meera@dueproof.demo', role: 'Member', who: 'Meera, who owns the security checks. One is due in two days.' },
]

import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Alert, Button } from '../components/ui'
import { api, ApiError, toFormErrors } from '../lib/api'
import { DEMO_ACCOUNT, DEMO_LOGINS } from '../lib/demo'
import type { Me } from '../lib/types'
import { useTitle } from '../lib/useTitle'

/** Public home page: what DueProof is, for whom, and a one-click way into the demo. */
export default function LandingPage() {
  useTitle('Recurring compliance, with proof')
  const { setMe } = useAuth()
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openDemo() {
    setOpening(true)
    setError(null)
    try {
      setMe(await api<Me>('/auth/login/', 'POST', DEMO_ACCOUNT))
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 400
          ? 'The demo account isn’t set up on this server yet. Run “python manage.py seed_demo”, or create your own organization.'
          : (toFormErrors(e).general ?? 'Couldn’t open the demo.'),
      )
      setOpening(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="text-xl font-bold tracking-tight">
          Due<span className="text-indigo-600">Proof</span>
        </span>
        <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
          <Link to="/login" className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100">Log in</Link>
          <Link to="/signup" className="rounded-md bg-slate-900 px-3 py-2 text-white hover:bg-slate-700">Create organization</Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-16">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.4rem]">
              Recurring compliance work, done on time and provable.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              Tax filings, access reviews, backup tests, licence renewals. DueProof gives each one a schedule and an owner,
              reminds people before it’s due, won’t let anyone mark it done without proof, and turns it all into an audit report.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button onClick={openDemo} loading={opening} className="px-5 py-3 text-base!">Explore the demo</Button>
              <Link to="/signup" className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-base font-medium text-slate-800 hover:bg-slate-50">
                Create your organization
              </Link>
            </div>
            <p className="mt-3 text-sm text-slate-500">The demo opens as Asha, the admin of a sample company. No sign-up needed.</p>
            {error && <div className="mt-4 max-w-xl"><Alert>{error}</Alert></div>}
          </div>
          <Ledger />
        </section>

        {/* The problem */}
        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
              In small teams, recurring obligations live in a spreadsheet and someone’s memory. That fails in three ways.
            </h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              <Problem title="Nobody owns it">
                The reminder goes to a shared inbox, or to the one person who remembers. When they’re on leave, the filing is quietly missed.
              </Problem>
              <Problem title="The proof is scattered">
                The work gets done, but the receipt sits in someone’s email. When an auditor or client asks, it takes days to rebuild.
              </Problem>
              <Problem title="Nobody sees it coming">
                No one notices a task is late until the penalty notice, the failed audit, or the expired certificate.
              </Problem>
            </div>
          </div>
        </section>

        {/* How it works: a real sequence */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
          <ol className="mt-10 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
            <Step n={1} title="Define it once">
              Pick a schedule (monthly on the 20th, the last day of each quarter) or start from a template. Due dates for the next year are created for you.
            </Step>
            <Step n={2} title="Give it an owner">
              Every due item belongs to one person. They get a reminder inside the app when it’s close, and admins hear about anything overdue.
            </Step>
            <Step n={3} title="Close it with proof">
              The owner uploads the receipt, report or screenshot and marks it done. Without proof, the button stays off.
            </Step>
            <Step n={4} title="Answer the auditor">
              Pick a period and get every item: done on time, late or missed, who did it, and the proof. Download it as CSV.
            </Step>
          </ol>
        </section>

        {/* Real product */}
        <section className="bg-indigo-950 text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">The admin’s dashboard: what needs attention first</h2>
              <p className="mt-4 text-indigo-200">
                Overdue at the top, then what’s inside its reminder window, then the next date for everything else. “Today” is worked out in your organization’s own timezone.
              </p>
            </div>
            <figure className="mt-10 overflow-hidden rounded-xl border border-indigo-800 bg-white shadow-2xl shadow-indigo-950">
              <img src={`${import.meta.env.BASE_URL}landing-dashboard.png`} width={1280} height={900} loading="lazy"
                alt="DueProof dashboard showing one overdue tax return, two items due soon, upcoming items and recently completed work" className="block h-auto w-full" />
            </figure>
          </div>
        </section>

        {/* Who it's for + demo logins */}
        <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Built for teams too small for a compliance department</h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              For the ops manager, founder or finance lead who answers for compliance on top of a full-time job, and for the people who do the work.
              It sets up in minutes: no integrations, no consultants, no email service to configure.
            </p>
            <p className="mt-4 leading-relaxed text-slate-600">
              Your team owns its rules. DueProof doesn’t pretend to know every legal deadline; when a rule changes, you edit it, and past records stay exactly as they were.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Try each point of view</h2>
            <p className="mt-1 text-sm text-slate-600">
              All three use the password <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">{DEMO_ACCOUNT.password}</code>.
            </p>
            <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200">
              {DEMO_LOGINS.map((login) => (
                <li key={login.email} className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">
                    {login.email} <span className="ml-1 font-normal text-slate-500">({login.role.toLowerCase()})</span>
                  </p>
                  <p className="text-sm text-slate-600">{login.who}</p>
                </li>
              ))}
            </ul>
            <Link to="/login" className="mt-4 inline-block text-sm font-medium text-indigo-700 hover:underline">Log in with one of these</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500 sm:px-6">DueProof. Built as a take-home project.</div>
      </footer>
    </div>
  )
}

function Problem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-red-300 pl-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 leading-relaxed text-slate-600">{children}</p>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li>
      <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white tabular-nums">{n}</span>
      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 leading-relaxed text-slate-600">{children}</p>
    </li>
  )
}

/** The hero picture: three due items from a real compliance calendar, one of them closed with proof. */
function Ledger() {
  const rows = [
    { title: 'Monthly GST return', who: 'Ravi', due: '20 Oct', state: '5 days overdue', tone: 'text-red-700', dot: 'bg-red-500' },
    { title: 'Weekly backup check', who: 'Meera', due: '27 Oct', state: 'Due in 2 days', tone: 'text-amber-700', dot: 'bg-amber-500' },
    { title: 'Monthly TDS payment', who: 'Ravi', due: '7 Oct', state: 'Done 6 Oct', tone: 'text-emerald-700', dot: 'bg-emerald-500', proof: 'tds-challan-oct.pdf' },
  ]
  return (
    <figure aria-label="Example: three due items, one overdue, one due soon, one done with proof attached"
      className="relative rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_60px_-20px_rgba(49,46,129,0.35)]">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <p className="text-sm font-semibold text-slate-900">Northwind Labs, October</p>
        <p className="text-xs text-slate-500">3 of 7 obligations</p>
      </div>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
        {rows.map((row) => (
          <li key={row.title} className="relative px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{row.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">Owner {row.who}, due {row.due}</p>
              </div>
              <span className={`flex shrink-0 items-center gap-1.5 text-sm font-medium ${row.tone}`}>
                <span className={`h-2 w-2 rounded-full ${row.dot}`} aria-hidden="true" />
                {row.state}
              </span>
            </div>
            {row.proof && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="truncate rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 text-xs">{row.proof}</span>
                <span className="stamp shrink-0 -rotate-6 rounded-md border-2 border-emerald-600 px-2.5 py-1 text-xs font-extrabold tracking-wide text-emerald-700">
                  Proof attached
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </figure>
  )
}

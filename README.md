# DueProof

A small web app for teams that have recurring compliance work — tax filings, access reviews, backup tests, licence renewals — and need to prove they did it.

Each task has a schedule, an owner, and can't be marked done without attaching proof. Everything ends up in an audit-ready report.

- **Live app:** [dueproof-production.up.railway.app](https://dueproof-production.up.railway.app) — hit "Explore the demo" to jump straight in
- **Demo video:** [Watch demo walkthrough](https://drive.google.com/file/d/1GpxqDgM3zTojLQz3P_i8gv9cr3-NQWMb/view?usp=sharing)
- **Demo logins** (password: `DueProof-Demo-2026`):

  | Email | Role |
  |---|---|
  | `admin@dueproof.demo` | Admin — can create obligations, invite people, reopen items |
  | `ravi@dueproof.demo` | Member — owns the tax filings (one is overdue) |
  | `meera@dueproof.demo` | Member — owns the security checks (one is due in 2 days) |

---

## The problem

Small teams (10–100 people) usually manage recurring compliance work through spreadsheets and calendar reminders. That breaks in three ways:

1. **No clear owner.** When the one person who remembers is on leave or leaves the company, the task is missed silently.
2. **No proof.** The work might get done, but the receipt or signed review is buried in email. When an auditor asks, someone spends days tracking it down.
3. **No early warning.** Nobody notices something is late until a penalty lands or a certificate expires.

DueProof is designed for small teams (10–100 people) with two primary user personas:

### Who it's for

- **The Primary User (The Compliance Answerable):**
  - **Job Titles:** Ops Manager, Head of Finance, IT Lead, or Founder.
  - **Pain Point:** Compliance is not their full-time job — they do it alongside their core responsibilities. They are the ones legally or managerially answerable if a deadline is missed.
  - **What they need:** A dashboard showing what's overdue, what's due this week, and a one-click audit report exportable to CSV when investors or auditors arrive.

- **The Secondary User (The Task Owner):**
  - **Job Titles:** The DevOps engineer (runs the backup restore test), the accountant (files GST), the HR lead (runs annual training).
  - **Pain Point:** They don't want to learn complex enterprise GRC tools; they just want to know: *"What is assigned to me, when is it due, and what proof do I have to attach to close it?"*
  - **What they need:** A clear view of their assigned obligations and a straightforward way to attach evidence and close tasks.

---

## What it does

- **Define once, recur automatically.** Set a schedule, an owner and a reminder window. Due dates for the next 12 months are generated upfront. Seven starter templates cover the most common tasks.
- **One owner per item.** Every due date is assigned to a named person, not a shared inbox.
- **Done means proven.** If a task requires evidence, the app blocks completion until a file is attached.
- **Early reminders, admin escalation.** The owner gets reminded before the deadline. Once it's overdue, every admin gets alerted too.
- **Audit report in one click.** Filter by date, owner or category. See on-time rates and download a CSV.
- **Full audit trail.** Every action — create, edit, upload, complete, reopen — is logged and can't be altered.

---

## How it works

```
Browser (React) ──/api/──► Django + DRF ──► Postgres
                                │
                                └──► Evidence files (disk or S3)
```

One Docker container: Vite builds the React app, Django serves it via WhiteNoise alongside the API. No separate frontend server.

**Backend:** Python 3.13, Django 5.2, DRF, Postgres (SQLite locally), python-dateutil, gunicorn.  
**Frontend:** React 19, TypeScript, Vite, React Router, Tailwind CSS.

### A few decisions worth knowing

**Schedules are stored as RRULEs** (the same format used by Google Calendar). Users never type one — the form builds the rule from dropdowns and shows the next due dates in plain English.

**Status is never stored.** "Overdue / due soon / upcoming" is computed at request time from the due date and today's date in the org's timezone. Storing it would mean it goes stale every night at midnight.

**Notifications need no background job.** Whenever anyone in the org opens the app, the server checks if any new reminders or overdue alerts need to be created. A unique constraint makes it safe to run this check on every request — it never creates duplicates.

**Multi-tenancy through the query layer.** Every query is filtered by the logged-in user's organization. Looking up another org's item returns a 404, not a 403 — so it doesn't even confirm the item exists.

**Audit entries are append-only in code.** The `AuditLog` model overrides `save()` and `delete()` to raise an error on any attempt to modify or remove a row.

**Evidence is never public.** Files are served through Django after an org check, always as attachments with `X-Content-Type-Options: nosniff` and `Cache-Control: private`.

**CSV formula injection is handled.** Cells starting with `=`, `+`, `-` or `@` are prefixed with `'` before writing, so a malicious title can't become a spreadsheet formula.

### Project layout

```
backend/
  config/        settings, URL routing, health check
  orgs/          organizations, members, invites, auth
  compliance/    obligations, occurrences, evidence, audit log
    recurrence.py     RRULE → due dates
    status.py         derive status from dates
    services.py       all writes + audit entries in one transaction
    reports.py        audit report and CSV
  notifications/ in-app reminders and overdue alerts
frontend/src/
  pages/         one file per screen
  components/    layout, notification bell, schedule picker
  lib/           API client, types, formatting
```

---

## Run locally

Requires Python 3.12+ and Node 22+.

```bash
git clone <this repo> dueproof && cd dueproof

# Backend — terminal 1
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # set SECRET_KEY inside
python manage.py migrate
python manage.py seed_demo # optional demo data
python manage.py runserver # runs on :8000

# Frontend — terminal 2
cd frontend
npm install
npm run dev                # runs on :5173, proxies /api to Django
```

Useful: `python manage.py seed_demo --reset` refreshes demo data with today's dates. `npm run build` produces the production bundle Django serves in Docker.

---

## Deploy on Railway

1. New project → deploy from GitHub. Railway picks up the `Dockerfile` automatically.
2. Add a Postgres plugin (or paste any Postgres URL).
3. Set environment variables:

   | Variable | Value |
   |---|---|
   | `SECRET_KEY` | any long random string |
   | `DEBUG` | `False` |
   | `DATABASE_URL` | your Postgres URL |
   | `SEED_DEMO` | `1` to seed the demo org on first start |
   | `MEDIA_ROOT` | path on a mounted volume, e.g. `/data/media` |

   Or use S3: set `S3_BUCKET`, `S3_ENDPOINT_URL`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

4. Settings → Networking → **Generate domain**. Health check path: `/api/health/`.

Migrations run on every start. Without a volume or S3 bucket, uploaded files are lost on redeploy.

---

## Testing

No automated test suite. All testing was done manually against the running app — the full test plan, edge cases covered (timezone edge cases, 31st-of-month recurrence, duplicate prevention, cross-org permission checks, file validation) and a browser walkthrough are in [TESTING.md](TESTING.md).

---

## Known gaps

- Notifications are in-app only. No email, Slack or WhatsApp yet.
- One organization per account. No switching between orgs.
- Templates are starting points, not legal advice. Deadlines change; teams own their rules.
- Due dates are calendar days only. No time-of-day precision.
- No password reset or 2FA.

---

## What's next

Email and Slack reminders · maintained template packs for Indian statutory, SOC 2, ISO 27001 · multi-org support for accountants serving several clients · automated tests in CI.

---

## Credits

Django, DRF, React, Vite, React Router, Tailwind CSS, python-dateutil, django-storages, WhiteNoise, gunicorn.  
See [WRITEUP.md](WRITEUP.md) for the full product write-up.

# DueProof: product write-up

## 1. What problem does it solve, and for whom?

Every organization has recurring obligations it must meet on schedule and later prove: GST returns, quarterly access reviews, backup tests, licence renewals. In 10–100 person teams these live in spreadsheets and calendar reminders, so tasks are missed when the one person who remembers is away, and proof is scattered when an auditor asks. DueProof is for the person answerable for compliance (an ops, finance or IT lead) and the task owners who do the work.

<!-- TODO: add one line from a real person you asked, e.g. "Our CA reminds us on WhatsApp; last year we paid a late fee twice." -->

## 2. Key product decisions

- **Done means proven.** If an obligation requires evidence, an item cannot be closed without a file. This is what separates compliance from a to-do list: the audit question is "show me", not "did you".
- **The team owns its rules.** DueProof doesn't claim to know legal deadlines, which change and vary by business. Teams start from editable templates; editing a schedule moves only future, open due dates, never history or uploaded proof.
- **No scheduler, no email.** Reminders and overdue alerts are created when anyone opens the app, deduplicated by a database constraint. Evaluators can see every flow without inboxes or background jobs. Status is computed from dates in the organization's timezone, never stored.

## 3. What I cut, and what's next

Cut: email/Slack delivery, multiple organizations per user, password reset, automated evidence collection, and an automated test suite (testing is a documented manual plan in TESTING.md). Next: email and Slack reminders, maintained template packs (Indian statutory, SOC 2), and multi-organization access for accountants serving several clients.

## 4. What broke or surprised me

- My first database query for reminders used date arithmetic that Postgres accepts but SQLite rejects; I moved the per-item window check into Python.
- The frontend showed "server unreachable" while Django was running. Node resolved `localhost` to IPv6 and reached a different app on port 8000; pointing the proxy at `127.0.0.1` fixed it.
- Adding S3 support broke `pip install`: boto3 requires python-dateutil below 3.0.
- "Monthly on the 31st" skips 30-day months by design, so the form offers "last day of the month" and warns otherwise.

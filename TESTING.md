# Testing

DueProof has no automated test suite. Instead, every feature was checked against the running app as it was built: through the API with a script, and through a real browser (headless Chromium) at desktop and phone widths. This file is the test plan and the record of what was checked.

**How to repeat it:** run the app locally (see README), then `python manage.py seed_demo --reset` for a known starting point. Demo password: `DueProof-Demo-2026`. Before submitting, the **Production** column should be filled in on the live URL.

Legend: ✅ passed · ⬜ not yet run

## 1. Home page, sign-up, login and invites

| # | Scenario | Expected | Local | Production |
|---|---|---|---|---|
| 1.0a | Open `/` while logged out (desktop and 390 px phone) | Home page: what DueProof does, the problem, how it works, demo logins; no console errors | ✅ | ⬜ |
| 1.0b | Click **Explore the demo** | Logged in as the demo admin, dashboard shown at `/` | ✅ | ⬜ |
| 1.0c | Log out | Back on the home page | ✅ | ⬜ |
| 1.1 | Open any other page while logged out | Sent to `/login`, brought back to that page after logging in | ✅ | ⬜ |
| 1.2 | Sign up with a weak password (`12345`) | Field errors: too short, too common, entirely numeric | ✅ | ⬜ |
| 1.3 | Sign up with an email that already exists | "An account with this email already exists" | ✅ | ⬜ |
| 1.4 | Sign up with an invalid timezone (API) | 400 "not a valid timezone" | ✅ | ⬜ |
| 1.5 | Sign up correctly | Logged in as **admin** of a new organization | ✅ | ⬜ |
| 1.6 | Log in with a wrong password | "Incorrect email or password" (same message for unknown email) | ✅ | ⬜ |
| 1.7 | Log in with the email in capitals | Works (emails are case-insensitive) | ✅ | ⬜ |
| 1.8 | 12 failed logins within a minute | From the 11th: "Too many attempts. Please wait a minute" (429) | ✅ | ⬜ |
| 1.9 | Sign-up request without the CSRF token | Rejected (403) | ✅ | ⬜ |
| 1.10 | Admin creates an invite | One-time link shown with a Copy button | ✅ | ⬜ |
| 1.11 | Open the invite link in a private window, set name and password | Joins the org as a member, logged in | ✅ | ⬜ |
| 1.12 | Use the same invite link again | "This invite link has expired or was already used" | ✅ | ⬜ |
| 1.13 | Member opens Team | Sees members; no invite form | ✅ | ⬜ |
| 1.14 | Log out, then reload | Back on the login page | ✅ | ⬜ |

## 2. Data isolation and permissions

| # | Scenario | Expected | Local | Production |
|---|---|---|---|---|
| 2.1 | User from another org opens an obligation / due item by URL | "Doesn't exist or belongs to another organization" (404) | ✅ | ⬜ |
| 2.2 | User from another org downloads a proof file by URL | 404 | ✅ | ⬜ |
| 2.3 | Another org's dashboard, list, report and bell | Empty: nothing leaks across organizations | ✅ | ⬜ |
| 2.4 | Member tries to create or edit an obligation (API) | 403 "Only organization admins can do this" | ✅ | ⬜ |
| 2.5 | Member who isn't the owner tries to upload proof / complete | 403; page shows "Only the owner or an admin can…" | ✅ | ⬜ |
| 2.6 | Owner tries to reopen a completed item | 403 "Only admins can reopen" | ✅ | ⬜ |
| 2.7 | Admin picks an owner from another organization (API) | 400 "Choose a member of your organization" | ✅ | ⬜ |
| 2.8 | Member opens Settings | Fields read-only, no Save button; PATCH returns 403 | ✅ | ⬜ |
| 2.9 | Marking someone else's notification as read (API) | 404 | ✅ | ⬜ |

## 3. Obligations and schedules

| # | Scenario | Expected | Local | Production |
|---|---|---|---|---|
| 3.1 | Click a template chip | Title, description, category, schedule, reminder and proof fields filled | ✅ | ⬜ |
| 3.2 | Choose "Quarterly, Mar/Jun/Sep/Dec, last day" | Preview: "Quarterly on the last day of Mar, Jun, Sep, Dec", next 31 Dec, 31 Mar, 30 Jun, 30 Sep | ✅ | ⬜ |
| 3.3 | Monthly on the last day | Jan 31, **Feb 28**, Mar 31, Apr 30 | ✅ | ⬜ |
| 3.4 | Monthly on the 31st | Warning shown that months without a 31st are skipped | ✅ | ⬜ |
| 3.5 | Yearly on 29 February | Only leap years (2028) | ✅ | ⬜ |
| 3.6 | Custom rule `FREQ=HOURLY` / `BYMONTHDAY=40` / 30 February | Rejected with a clear message | ✅ | ⬜ |
| 3.7 | Blank title, reminder of 900 days | Field errors; nothing saved | ✅ | ⬜ |
| 3.8 | Start date in the past | Tracking starts from today; no flood of old overdue items | ✅ | ⬜ |
| 3.9 | Create an obligation | 12 months of due dates created; creating them again adds none | ✅ | ⬜ |
| 3.10 | Complete one item, then change the schedule from the 20th to the 15th | Completed item stays; future items move to the 15th; audit shows "edited: schedule" | ✅ | ⬜ |
| 3.11 | Save the form with no changes | No new audit entry | ✅ | ⬜ |
| 3.12 | Archive an obligation | Future open items removed; history and proof kept; can't be edited | ✅ | ⬜ |
| 3.13 | Edit a template-based schedule | The form reopens with the same choices (every template round-trips) | ✅ | ⬜ |

## 4. Proof and completion

| # | Scenario | Expected | Local | Production |
|---|---|---|---|---|
| 4.1 | Proof required, no file attached | "Mark as done" disabled with "Upload proof first"; API returns 400 | ✅ | ⬜ |
| 4.2 | Upload `.exe` | Rejected before upload: "files aren't accepted" (server rejects too) | ✅ | ⬜ |
| 4.3 | Upload an empty file / 11 MB file | "This file is empty" / "at most 10 MB" | ✅ | ⬜ |
| 4.4 | Upload a PDF, add a note, mark done | Status Completed; "Done by … on …"; activity shows upload and completion | ✅ | ⬜ |
| 4.5 | Download proof | File downloads (as an attachment, never opened inside the site) | ✅ | ⬜ |
| 4.6 | Upload or remove proof after completion | Refused until an admin reopens | ✅ | ⬜ |
| 4.7 | Admin reopens with a reason, owner removes the wrong file | Item open again; file removed from storage; reason in the activity log | ✅ | ⬜ |
| 4.8 | Obligation without proof required | Can be marked done without a file | ✅ | ⬜ |

## 5. Dashboard, notifications and time

| # | Scenario | Expected | Local | Production |
|---|---|---|---|---|
| 5.1 | Status with a 7-day reminder window | Yesterday → overdue; today → due soon ("Due today"); +7 days → due soon; +8 days → upcoming | ✅ | ⬜ |
| 5.2 | "Today" near midnight | 23:30 UTC on 24 Oct counts as 25 Oct for an org in Asia/Kolkata | ✅ | ⬜ |
| 5.3 | Demo dashboard as admin | 1 overdue, 2 due soon, upcoming shows the **next** due date of each obligation | ✅ | ⬜ |
| 5.4 | "My items" toggle as Ravi | Only Ravi's obligations | ✅ | ⬜ |
| 5.5 | Bell as owner of a due-soon and an overdue item | 2 unread: "due in 2 days", "overdue by 3 days" | ✅ | ⬜ |
| 5.6 | Bell as admin | Overdue alerts for everyone's items, with "(owner: …)" | ✅ | ⬜ |
| 5.7 | Item 9 days away with a 7-day window | No notification yet | ✅ | ⬜ |
| 5.8 | Reload the app many times | No duplicate notifications | ✅ | ⬜ |
| 5.9 | Mark an item done | Bell count drops immediately; the alert reads "is done, marked by …" | ✅ | ⬜ |
| 5.10 | Mark all read | Count goes to 0 | ✅ | ⬜ |

## 6. Reports

| # | Scenario | Expected | Local | Production |
|---|---|---|---|---|
| 6.1 | Default report | Last 90 days | ✅ | ⬜ |
| 6.2 | Done the day before it was due / 30 days after | "Done on time" / "Done late" (compared in the org's timezone) | ✅ | ⬜ |
| 6.3 | Overdue item of an obligation archived later | Still listed, marked "archived" | ✅ | ⬜ |
| 6.4 | Demo, last 12 months | 41 items · 37 on time · 3 late · 1 overdue · 90% on-time rate | ✅ | ⬜ |
| 6.5 | Filter by status / category / owner | Only matching rows | ✅ | ⬜ |
| 6.6 | From date after To date / invalid date / range over 3 years | Clear error, no crash | ✅ | ⬜ |
| 6.7 | Download CSV | Named `compliance-report-<from>-to-<to>.csv`; UTF-8 with a byte-order mark so Excel keeps non-English names | ✅ | ⬜ |
| 6.8 | Obligation titled `=HYPERLINK("evil") GST` | CSV cell starts with `'`, so Excel shows text instead of running a formula | ✅ | ⬜ |

## 7. Errors, layout and deployment

| # | Scenario | Expected | Local | Production |
|---|---|---|---|---|
| 7.1 | Stop the backend, reload the app; start it again, click Try again | "Can’t reach DueProof right now" with Try again (not a misleading login page); Try again continues to the page | ✅ | n/a |
| 7.2 | Unknown API URL `/api/nope/` | JSON 404, not an HTML page | ✅ | ⬜ |
| 7.3 | Unknown page URL `/nope` | "Page not found" inside the app | ✅ | ⬜ |
| 7.4 | Phone width (390 px): dashboard, item page, settings, reports | Readable; nav scrolls sideways; buttons reachable | ✅ | ⬜ |
| 7.5 | Browser console during the full walkthrough | No errors | ✅ | ⬜ |
| 7.6 | Production mode (`DEBUG=False`, gunicorn) | `/`, `/dashboard` → app; `/api/health/` → JSON; `/static/…` → assets; `/admin/` → admin | ✅ | ⬜ |
| 7.7 | App started without `SECRET_KEY` | Refuses to start with a clear message | ✅ | n/a |
| 7.8 | Live URL in a private window | Loads; demo logins work | n/a | ⬜ |
| 7.9 | Upload proof, redeploy, download it again | File still there (volume or bucket configured) | n/a | ⬜ |

## Bugs found while testing (and fixed)

| What happened | Cause | Fix |
|---|---|---|
| A rule with `BYMONTHDAY=40` was accepted | The date library doesn't range-check rule parts | Validator checks every numeric part and that the rule produces at least one date |
| Notification check crashed on SQLite | Date arithmetic across columns isn't portable between Postgres and SQLite | Narrow in the database, apply each item's reminder window in Python |
| App showed "Could not reach the server" locally | Node resolved `localhost` to IPv6 and reached a different program on port 8000 | Dev proxy points at `127.0.0.1` |
| `pip install` failed after adding S3 support | `boto3` requires `python-dateutil` below 3.0 | Pinned dateutil 2.9 |
| Upcoming list filled with one weekly task | Every weekly date in 45 days was listed | Show the next due date per obligation |
| Bell count stayed at 1 after marking an item done | The bell only refreshed on page change | It refreshes after any change |
| Login page logged 403 errors in the console | "Not logged in" was returned as an error | `/api/auth/me/` returns `null` instead |
| A refused request appeared in the console right after logging out | The logout itself triggered the bell's refresh | Login/logout don't trigger widget refreshes |
| With the server down, the app quietly showed the login page | A failed login check was treated as "logged out" | A "Can’t reach DueProof" screen with Try again |

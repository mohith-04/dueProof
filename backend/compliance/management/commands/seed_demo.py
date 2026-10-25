"""Create a ready-to-explore demo organization.

    python manage.py seed_demo            # create it if it doesn't exist yet
    python manage.py seed_demo --reset    # delete and recreate it (fresh dates)

Everything is relative to today, so the demo always shows a realistic mix:
something overdue, something due this week, upcoming work, and six months of
completed history with proof files, notes and an audit trail.
"""

import os
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction

from compliance.models import AuditLog, Evidence, Obligation, Occurrence
from compliance.recurrence import due_dates
from compliance.services import add_evidence, complete_occurrence, create_obligation
from compliance.status import today_in
from orgs.models import Invite, Member, Organization

User = get_user_model()

ORG_NAME = "Northwind Labs (demo)"
TIMEZONE = "Asia/Kolkata"
DEFAULT_PASSWORD = "DueProof-Demo-2026"
PEOPLE = [
    # email, name, role
    ("admin@dueproof.demo", "Asha Rao", Member.Role.ADMIN),
    ("ravi@dueproof.demo", "Ravi Kumar", Member.Role.MEMBER),
    ("meera@dueproof.demo", "Meera Iyer", Member.Role.MEMBER),
]
HISTORY_DAYS = 185


def tiny_pdf(title: str, lines: list[str]) -> bytes:
    """A small, valid one-page PDF so demo proof files open in any viewer."""
    def esc(text: str) -> str:
        return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    text_ops = ["BT /F1 16 Tf 72 760 Td (" + esc(title) + ") Tj ET"]
    for i, line in enumerate(lines):
        text_ops.append(f"BT /F1 11 Tf 72 {730 - i * 18} Td ({esc(line)}) Tj ET")
    stream = "\n".join(text_ops).encode("latin-1", "replace")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


class Command(BaseCommand):
    help = "Create a demo organization with users, obligations, history and proof files."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete the existing demo organization first.")
        parser.add_argument("--password", default=os.environ.get("DEMO_PASSWORD", DEFAULT_PASSWORD),
                            help="Password for all demo users (default: DEMO_PASSWORD env var or a fixed demo password).")

    def handle(self, *args, **options):
        existing = Organization.objects.filter(name=ORG_NAME).first()
        if existing and not options["reset"]:
            self.stdout.write("Demo organization already exists. Use --reset to recreate it.")
            self.print_logins(options["password"])
            return
        if existing:
            self.delete_demo(existing)

        with transaction.atomic():
            self.build(options["password"])
        self.stdout.write(self.style.SUCCESS("Demo organization created."))
        self.print_logins(options["password"])

    # --- helpers -------------------------------------------------------------------

    def print_logins(self, password):
        self.stdout.write("Logins (all share one password):")
        for email, name, role in PEOPLE:
            self.stdout.write(f"  {email:<24} {role:<7} {name}")
        self.stdout.write(f"  password: {password}")

    def delete_demo(self, org):
        emails = [p[0] for p in PEOPLE]
        evidence_files = list(Evidence.objects.filter(occurrence__obligation__org=org).values_list("file", flat=True))
        with transaction.atomic():
            Occurrence.objects.filter(obligation__org=org).delete()  # cascades evidence + notifications
            Obligation.objects.filter(org=org).delete()
            AuditLog.objects.filter(org=org).delete()  # bulk delete bypasses the per-row guard; demo reset only
            org.delete()
            User.objects.filter(username__in=emails).delete()
        storage = Evidence._meta.get_field("file").storage
        for name in evidence_files:
            storage.delete(name)
        self.stdout.write("Removed the previous demo organization.")

    def build(self, password):
        org = Organization.objects.create(name=ORG_NAME, timezone=TIMEZONE)
        members = {}
        for email, name, role in PEOPLE:
            first, _, last = name.partition(" ")
            user = User.objects.create_user(username=email, email=email, password=password, first_name=first, last_name=last)
            members[email.split("@")[0]] = Member.objects.create(org=org, user=user, role=role)
        asha, ravi, meera = members["admin"], members["ravi"], members["meera"]
        Invite.create(org=org, email="new.hire@dueproof.demo", role=Member.Role.MEMBER, invited_by=asha)

        today = today_in(TIMEZONE)
        tz = ZoneInfo(TIMEZONE)
        history_start = today - timedelta(days=HISTORY_DAYS)
        weekday = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"][(today + timedelta(days=2)).weekday()]
        renewal = today + timedelta(days=20)

        specs = [
            # title, category, owner, rrule, remind, proof, description, how history went
            ("Monthly GST return", "finance", ravi, "FREQ=MONTHLY;BYMONTHDAY=20", 5, True,
             "File GSTR-3B on the GST portal and attach the filing acknowledgement (ARN).",
             {"late": [2], "open_latest": True}),
            ("Monthly TDS payment", "finance", ravi, "FREQ=MONTHLY;BYMONTHDAY=7", 3, True,
             "Deposit TDS for the previous month and attach the challan.", {}),
            ("Quarterly access review", "security", meera, "FREQ=MONTHLY;BYMONTH=3,6,9,12;BYMONTHDAY=-1", 14, True,
             "Review who has access to AWS, GitHub, Google Workspace and the finance tools. Remove leavers and unused admin rights.",
             {}),
            ("Weekly backup check", "security", meera, f"FREQ=WEEKLY;BYDAY={weekday}", 3, True,
             "Confirm last night's database backup completed and restore one table to staging.", {"late": [1]}),
            ("Annual policy review", "hr", asha, "FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=1", 30, True,
             "Review and re-approve the employee handbook, leave policy and IT acceptable-use policy.", {}),
            ("Fire safety drill", "operations", asha, "FREQ=MONTHLY;BYMONTH=1,7;BYMONTHDAY=15", 14, True,
             "Run an evacuation drill. Record attendance and time to assemble.", {"late": [0]}),
            ("Domain and SSL certificate renewal", "security", asha,
             f"FREQ=YEARLY;BYMONTH={renewal.month};BYMONTHDAY={renewal.day}", 30, False,
             "Renew northwindlabs.example and its TLS certificate before expiry.", {}),
        ]

        for title, category, owner, rule, remind, proof, description, history in specs:
            obligation = create_obligation(
                actor=asha, today=today, title=title, category=category, owner=owner, rrule=rule,
                start_date=history_start, remind_days_before=remind, evidence_required=proof, description=description,
            )
            created_at = datetime.combine(history_start, time(10, 0), tzinfo=tz)
            AuditLog.objects.filter(entity_type="obligation", entity_id=obligation.id).update(created_at=created_at)

            past = due_dates(rule, history_start, history_start, today - timedelta(days=1))
            for index_from_latest, due in enumerate(reversed(past)):
                occurrence = Occurrence.objects.create(obligation=obligation, due_date=due)
                if index_from_latest == 0 and history.get("open_latest"):
                    continue  # left undone on purpose: shows up as overdue
                late_by = 4 if index_from_latest in history.get("late", []) else 0
                done_on = due + timedelta(days=late_by) if late_by else due - timedelta(days=1 + index_from_latest % 3)
                done_on = min(done_on, today)
                self.complete(occurrence, owner, done_on, tz, title, proof)

    def complete(self, occurrence, owner, done_on: date, tz, title, proof_required):
        moment = datetime.combine(done_on, time(11 + occurrence.id % 6, 15 + occurrence.id % 40), tzinfo=tz)
        if proof_required:
            slug = title.lower().replace(" ", "-")
            name = f"{slug}-{occurrence.due_date:%Y-%m-%d}.pdf"
            pdf = tiny_pdf(title, [
                f"Period due: {occurrence.due_date:%d %b %Y}",
                f"Completed by: {owner.display_name} on {done_on:%d %b %Y}",
                "Demo proof file generated by DueProof seed_demo.",
            ])
            upload = ContentFile(pdf, name=name)
            upload.content_type = "application/pdf"
            evidence = add_evidence(occurrence, actor=owner, uploaded_file=upload)
            Evidence.objects.filter(pk=evidence.pk).update(uploaded_at=moment - timedelta(minutes=20))

        notes = ["", "Done.", "Checked and filed.", "No issues found.", "Reference attached."]
        complete_occurrence(occurrence, actor=owner, note=notes[occurrence.id % len(notes)])
        Occurrence.objects.filter(pk=occurrence.pk).update(completed_at=moment)
        audit = AuditLog.objects.filter(entity_type="occurrence", entity_id=occurrence.id)
        audit.filter(action="evidence.uploaded").update(created_at=moment - timedelta(minutes=20))
        audit.filter(action="occurrence.completed").update(created_at=moment)

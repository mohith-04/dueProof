"""Audit report: for every due item in a date range, what was due, whether and when
it was done, by whom, and with which proof files.

Archived obligations are included on purpose: an auditor asking about last year
must still see work for obligations that have since been retired.
"""

import csv
import io
from dataclasses import dataclass
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Prefetch, QuerySet

from compliance.models import Evidence, Occurrence
from orgs.models import Organization

MAX_RANGE_DAYS = 3 * 366
DEFAULT_RANGE_DAYS = 90


class ReportStatus:
    ON_TIME = "on_time"  # done on or before the due date
    LATE = "late"  # done after the due date
    OVERDUE = "overdue"  # not done, due date has passed
    OPEN = "open"  # not done, not due yet
    ALL = {ON_TIME, LATE, OVERDUE, OPEN}

    LABELS = {ON_TIME: "Done on time", LATE: "Done late", OVERDUE: "Overdue", OPEN: "Not due yet"}


@dataclass
class ReportFilters:
    date_from: date
    date_to: date
    category: str = ""
    owner_id: int | None = None
    status: str = ""


def parse_filters(params, today: date) -> tuple[ReportFilters | None, dict]:
    """Read ?from=&to=&category=&owner=&status= and return (filters, errors)."""
    errors: dict[str, str] = {}

    def read_date(key, default):
        raw = params.get(key, "")
        if not raw:
            return default
        try:
            return date.fromisoformat(raw)
        except ValueError:
            errors[key] = "Use the format YYYY-MM-DD."
            return default

    date_to = read_date("to", today)
    date_from = read_date("from", date_to - timedelta(days=DEFAULT_RANGE_DAYS))
    if not errors:
        if date_from > date_to:
            errors["from"] = "The start date must be before the end date."
        elif (date_to - date_from).days > MAX_RANGE_DAYS:
            errors["from"] = "Choose a range of three years or less."

    owner_id = None
    if params.get("owner"):
        try:
            owner_id = int(params["owner"])
        except ValueError:
            errors["owner"] = "Choose an owner from the list."

    status = params.get("status", "")
    if status and status not in ReportStatus.ALL:
        errors["status"] = "Unknown status."

    if errors:
        return None, errors
    return ReportFilters(date_from, date_to, params.get("category", ""), owner_id, status), {}


def report_status(occurrence: Occurrence, today: date, tz: ZoneInfo) -> str:
    if occurrence.completed_at is not None:
        completed_on = occurrence.completed_at.astimezone(tz).date()  # the org's calendar day
        return ReportStatus.ON_TIME if completed_on <= occurrence.due_date else ReportStatus.LATE
    return ReportStatus.OVERDUE if occurrence.due_date < today else ReportStatus.OPEN


def report_queryset(org: Organization, filters: ReportFilters) -> QuerySet:
    occurrences = (
        Occurrence.objects.filter(obligation__org=org, due_date__gte=filters.date_from, due_date__lte=filters.date_to)
        .select_related("obligation", "obligation__owner__user", "completed_by__user")
        .prefetch_related(Prefetch("evidence", queryset=Evidence.objects.select_related("uploaded_by__user")))
        .order_by("due_date", "obligation__title")
    )
    if filters.category:
        occurrences = occurrences.filter(obligation__category=filters.category)
    if filters.owner_id:
        occurrences = occurrences.filter(obligation__owner_id=filters.owner_id)
    return occurrences


def build_rows(org: Organization, filters: ReportFilters, today: date) -> list[dict]:
    tz = ZoneInfo(org.timezone)
    rows = []
    for occ in report_queryset(org, filters):
        status = report_status(occ, today, tz)
        if filters.status and status != filters.status:
            continue
        ob = occ.obligation
        rows.append({
            "occurrence_id": occ.id,
            "obligation_id": ob.id,
            "obligation": ob.title,
            "category": ob.get_category_display(),
            "owner": ob.owner.display_name,
            "archived": ob.archived_at is not None,
            "due_date": occ.due_date.isoformat(),
            "status": status,
            "status_label": ReportStatus.LABELS[status],
            "completed_at": occ.completed_at.astimezone(tz).isoformat(timespec="minutes") if occ.completed_at else None,
            "completed_by": occ.completed_by.display_name if occ.completed_by else None,
            "note": occ.completion_note,
            "evidence_required": ob.evidence_required,
            "evidence": [
                {"id": e.id, "file_name": e.file_name, "uploaded_by": e.uploaded_by.display_name if e.uploaded_by else None,
                 "uploaded_at": e.uploaded_at.astimezone(tz).isoformat(timespec="minutes")}
                for e in occ.evidence.all()
            ],
        })
    return rows


def summarize(rows: list[dict]) -> dict:
    counts = {status: 0 for status in ReportStatus.ALL}
    for row in rows:
        counts[row["status"]] += 1
    done = counts[ReportStatus.ON_TIME] + counts[ReportStatus.LATE]
    due = done + counts[ReportStatus.OVERDUE]  # items whose due date has passed or that are done
    return {
        "total": len(rows),
        **counts,
        "done": done,
        # Share of items that came due in the range and were done on time.
        "on_time_rate": round(100 * counts[ReportStatus.ON_TIME] / due) if due else None,
        "missing_proof": sum(1 for r in rows if r["status"] in (ReportStatus.ON_TIME, ReportStatus.LATE)
                             and r["evidence_required"] and not r["evidence"]),
    }


def _safe_cell(value) -> str:
    """Stop spreadsheet formula injection: a cell starting with = + - @ would run as a formula in Excel."""
    text = "" if value is None else str(value)
    return f"'{text}" if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def to_csv(org: Organization, filters: ReportFilters, rows: list[dict]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Due date", "Obligation", "Category", "Owner", "Status", "Completed at", "Completed by",
                     "Proof files", "Proof uploaded by", "Note", "Obligation archived"])
    for r in rows:
        writer.writerow([_safe_cell(v) for v in [
            r["due_date"], r["obligation"], r["category"], r["owner"], r["status_label"],
            r["completed_at"] or "", r["completed_by"] or "",
            "; ".join(e["file_name"] for e in r["evidence"]),
            "; ".join(sorted({e["uploaded_by"] or "" for e in r["evidence"]})),
            r["note"], "yes" if r["archived"] else "",
        ]])
    return "﻿" + buffer.getvalue()  # BOM so Excel opens UTF-8 (₹, names) correctly

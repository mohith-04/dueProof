"""Turns an obligation's RRULE into Occurrence rows.

Rules:
- Occurrences are generated up to HORIZON_DAYS ahead; the daily job tops them up.
- Dates before "today" are never generated: an obligation created today with a
  start date in the past starts tracking from today, instead of flooding the
  dashboard with overdue items nobody was asked to do.
- Completed occurrences and anything in the past are history and are never
  touched when a rule changes. Only future, incomplete occurrences are replaced.
- Every insert ignores conflicts on (obligation, due_date), so running any of this
  twice is harmless.
"""

from datetime import date, datetime, time, timedelta

from dateutil.rrule import rrulestr
from django.db import transaction

from compliance.models import Obligation, Occurrence

HORIZON_DAYS = 365


def due_dates(rule: str, start: date, from_date: date, until: date) -> list[date]:
    """All due dates the rule produces between from_date and until (both inclusive)."""
    if until < from_date:
        return []
    schedule = rrulestr(rule.removeprefix("RRULE:"), dtstart=datetime.combine(start, time.min))
    window_start = datetime.combine(max(start, from_date), time.min)
    window_end = datetime.combine(until, time.min)
    return [moment.date() for moment in schedule.between(window_start, window_end, inc=True)]


def generate_occurrences(obligation: Obligation, today: date, horizon_days: int = HORIZON_DAYS) -> int:
    """Create missing occurrences from today up to the horizon. Returns how many were added."""
    if obligation.archived_at is not None:
        return 0
    dates = due_dates(obligation.rrule, obligation.start_date, today, today + timedelta(days=horizon_days))
    before = obligation.occurrences.count()
    Occurrence.objects.bulk_create(
        [Occurrence(obligation=obligation, due_date=d) for d in dates],
        ignore_conflicts=True,
    )
    return obligation.occurrences.count() - before


@transaction.atomic
def regenerate_future(obligation: Obligation, today: date) -> None:
    """After a schedule change or archive: replace future, incomplete occurrences only.

    Future occurrences that already have evidence attached are kept, so no uploaded
    proof is ever lost by editing a rule.
    """
    obligation.occurrences.filter(
        due_date__gte=today,
        completed_at__isnull=True,
        evidence__isnull=True,
    ).delete()
    generate_occurrences(obligation, today)


def top_up_all(today: date) -> int:
    """Daily job: extend every active obligation's schedule to the horizon."""
    added = 0
    for obligation in Obligation.objects.filter(archived_at__isnull=True).iterator():
        added += generate_occurrences(obligation, today)
    return added

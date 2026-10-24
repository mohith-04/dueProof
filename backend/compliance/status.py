"""Occurrence status is derived from dates, never stored.

A stored status column would be wrong the morning after it was written. Instead
each status is computed from the due date, completion, the obligation's reminder
window and "today" in the organization's own timezone.
"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from django.db import models


class Status(models.TextChoices):
    COMPLETED = "completed", "Completed"
    OVERDUE = "overdue", "Overdue"
    DUE_SOON = "due_soon", "Due soon"
    UPCOMING = "upcoming", "Upcoming"


def today_in(timezone_name: str) -> date:
    """The calendar date right now in the given timezone (e.g. Asia/Kolkata).

    The server runs in UTC: at 23:30 UTC it is already the next day in India.
    """
    return datetime.now(ZoneInfo(timezone_name)).date()


def occurrence_status(*, due_date: date, completed: bool, remind_days_before: int, today: date) -> Status:
    if completed:
        return Status.COMPLETED
    if due_date < today:
        return Status.OVERDUE
    if due_date - today <= timedelta(days=remind_days_before):
        return Status.DUE_SOON  # due today counts as due soon, not overdue
    return Status.UPCOMING

from datetime import datetime

from dateutil.rrule import rrulestr
from django.core.exceptions import ValidationError

ALLOWED_FREQUENCIES = {"DAILY", "WEEKLY", "MONTHLY", "YEARLY"}

# (min, max) for numeric parts; 0 is never allowed. Negative values count from the end.
NUMERIC_RANGES = {
    "INTERVAL": (1, 100),
    "BYMONTHDAY": (-31, 31),
    "BYMONTH": (1, 12),
    "BYSETPOS": (-366, 366),
}


def validate_rrule(value: str) -> None:
    """Accept a single RRULE such as 'FREQ=MONTHLY;BYMONTHDAY=20'.

    The start date is stored separately (Obligation.start_date), so DTSTART is not
    allowed inside the rule. Sub-daily frequencies make no sense for compliance tasks.
    The rule must also produce at least one date within five years, which rejects
    impossible rules like "every 30 February".
    """
    rule = (value or "").strip().upper()
    if rule.startswith("RRULE:"):
        rule = rule[len("RRULE:"):]
    if not rule:
        raise ValidationError("A recurrence rule is required.")
    if "DTSTART" in rule or "\n" in rule:
        raise ValidationError("Use a single RRULE without DTSTART; the start date is a separate field.")

    parts = dict(part.split("=", 1) for part in rule.split(";") if "=" in part)
    if parts.get("FREQ") not in ALLOWED_FREQUENCIES:
        raise ValidationError("FREQ must be DAILY, WEEKLY, MONTHLY or YEARLY.")

    for key, (low, high) in NUMERIC_RANGES.items():
        if key not in parts:
            continue
        for raw in parts[key].split(","):
            try:
                number = int(raw)
            except ValueError:
                raise ValidationError(f"{key} must be a number, got '{raw}'.") from None
            if number == 0 or not low <= number <= high:
                raise ValidationError(f"{key}={number} is out of range ({low} to {high}, not 0).")

    start = datetime(2026, 1, 1)
    try:
        schedule = rrulestr(rule, dtstart=start)
    except (ValueError, TypeError) as exc:
        raise ValidationError(f"Invalid recurrence rule: {exc}") from exc

    if not schedule.between(start, start.replace(year=start.year + 5), inc=True):
        raise ValidationError("This rule never produces a due date.")


def validate_evidence_file(uploaded_file) -> None:
    """Allow common proof formats up to the size limit. Files are always downloaded as
    attachments (never displayed inline), so a disguised HTML file can't run in the app."""
    from django.conf import settings

    if uploaded_file is None:
        raise ValidationError("Choose a file to upload.")
    extension = uploaded_file.name.rsplit(".", 1)[-1].lower() if "." in uploaded_file.name else ""
    if extension not in settings.EVIDENCE_EXTENSIONS:
        allowed = ", ".join(sorted(settings.EVIDENCE_EXTENSIONS))
        raise ValidationError(f"“.{extension or '?'}” files aren't accepted. Use one of: {allowed}.")
    if uploaded_file.size == 0:
        raise ValidationError("This file is empty.")
    if uploaded_file.size > settings.MAX_EVIDENCE_BYTES:
        raise ValidationError(f"Files can be at most {settings.MAX_EVIDENCE_BYTES // (1024 * 1024)} MB.")

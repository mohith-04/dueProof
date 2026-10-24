"""Plain-English descriptions of recurrence rules, e.g. "Monthly on the 20th".

Users never type RRULEs: the React form builds them from simple choices. This
turns them back into words for lists and detail pages.
"""

import calendar

MONTH_NAMES = list(calendar.month_name)  # index 1..12
WEEKDAYS = {"MO": "Monday", "TU": "Tuesday", "WE": "Wednesday", "TH": "Thursday", "FR": "Friday", "SA": "Saturday", "SU": "Sunday"}


def ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def day_text(bymonthday: str | None, start_day: int) -> str:
    if bymonthday is None:
        return f"the {ordinal(start_day)}"
    day = int(bymonthday)
    return "the last day" if day == -1 else f"the {ordinal(day)}"


def describe_rrule(rule: str, start_day: int = 1, start_month: int = 1) -> str:
    parts = dict(p.split("=", 1) for p in rule.upper().removeprefix("RRULE:").split(";") if "=" in p)
    freq = parts.get("FREQ")
    interval = int(parts.get("INTERVAL", "1"))
    months = parts.get("BYMONTH")
    monthday = parts.get("BYMONTHDAY")

    if freq == "DAILY":
        return "Every day" if interval == 1 else f"Every {interval} days"
    if freq == "WEEKLY":
        days = [WEEKDAYS.get(d, d) for d in parts.get("BYDAY", "").split(",") if d]
        when = f" on {', '.join(days)}" if days else ""
        return f"Every week{when}" if interval == 1 else f"Every {interval} weeks{when}"
    if freq == "MONTHLY":
        if months and "," in months:
            month_list = [MONTH_NAMES[int(m)] for m in months.split(",")]
            if months in {"3,6,9,12", "1,4,7,10", "2,5,8,11"}:
                return f"Quarterly on {day_text(monthday, start_day)} of {', '.join(m[:3] for m in month_list)}"
            return f"On {day_text(monthday, start_day)} of {', '.join(month_list)}"
        if interval == 1:
            return f"Monthly on {day_text(monthday, start_day)}"
        if interval == 3:
            return f"Every quarter on {day_text(monthday, start_day)}"
        if interval == 6:
            return f"Every 6 months on {day_text(monthday, start_day)}"
        return f"Every {interval} months on {day_text(monthday, start_day)}"
    if freq == "YEARLY":
        month = MONTH_NAMES[int(months)] if months and "," not in months else MONTH_NAMES[start_month]
        day = day_text(monthday, start_day).removeprefix("the ")
        if day == "last day":
            return f"Every year on the last day of {month}"
        return f"Every year on {month} {day}"
    return rule

"""Creates in-app notifications. No scheduler: this runs whenever someone in the
organization opens the app (the bell asks for notifications on every page).

Rules, using the org's own "today":
- An open item inside its reminder window → a reminder to the owner.
- An open item past its due date → an overdue alert to the owner and every admin.
Each (item, kind, person) is created at most once, so running this on every
request is safe and cheap.
"""

from datetime import timedelta

from django.db.models import Max

from compliance.models import Occurrence
from compliance.status import today_in
from notifications.models import Notification
from orgs.models import Member, Organization


def sync_notifications(org: Organization) -> int:
    """Create any notifications that are now due for this organization. Returns how many were added."""
    today = today_in(org.timezone)
    active = org.obligations.filter(archived_at__isnull=True)
    longest_window = active.aggregate(longest=Max("remind_days_before"))["longest"]
    if longest_window is None:
        return 0  # no active obligations

    # Narrow in the database, then apply each obligation's own reminder window in Python
    # (date arithmetic across columns isn't portable between Postgres and SQLite).
    candidates = (
        Occurrence.objects.filter(
            obligation__in=active,
            completed_at__isnull=True,
            due_date__lte=today + timedelta(days=longest_window),
        )
        .select_related("obligation")
        .only("id", "due_date", "obligation__owner_id", "obligation__remind_days_before")
    )
    admin_ids = list(org.members.filter(role=Member.Role.ADMIN).values_list("id", flat=True))

    wanted = []
    for item in candidates:
        if (item.due_date - today).days > item.obligation.remind_days_before:
            continue  # not inside its reminder window yet
        owner_id = item.obligation.owner_id
        if item.due_date < today:
            for recipient_id in {owner_id, *admin_ids}:
                wanted.append(Notification(occurrence_id=item.id, kind=Notification.Kind.OVERDUE, recipient_id=recipient_id))
        else:
            wanted.append(Notification(occurrence_id=item.id, kind=Notification.Kind.REMINDER, recipient_id=owner_id))

    if not wanted:
        return 0
    before = Notification.objects.filter(recipient__org=org).count()
    Notification.objects.bulk_create(wanted, ignore_conflicts=True)
    return Notification.objects.filter(recipient__org=org).count() - before


def active_unread(member: Member):
    """Unread notifications that still need attention: the item isn't done and the obligation isn't archived."""
    return member.notifications.filter(
        read_at__isnull=True,
        occurrence__completed_at__isnull=True,
        occurrence__obligation__archived_at__isnull=True,
    )

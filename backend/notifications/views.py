"""In-app notifications for the logged-in member.

/api/notifications/             GET   creates any newly due notifications, then returns {unread_count, items}
/api/notifications/<id>/read/   POST  mark one as read
/api/notifications/read-all/    POST  mark all as read
"""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from compliance.status import today_in
from notifications.models import Notification
from notifications.services import active_unread, sync_notifications
from orgs.permissions import IsOrgMember, current_member

LIST_LIMIT = 30


def describe(notification: Notification, today, viewer_id: int) -> str:
    occurrence = notification.occurrence
    title = occurrence.obligation.title
    days = (occurrence.due_date - today).days
    owner = occurrence.obligation.owner
    owner_text = "" if owner.id == viewer_id else f" (owner: {owner.display_name})"
    if occurrence.completed_at is not None:
        done_by = occurrence.completed_by.display_name if occurrence.completed_by else "someone"
        return f"“{title}” is done, marked by {done_by}."
    if notification.kind == Notification.Kind.OVERDUE:
        late = -days if days < 0 else 0
        return f"“{title}” is overdue by {late} day{'s' if late != 1 else ''}{owner_text}."
    if days <= 0:
        return f"“{title}” is due today{owner_text}."
    return f"“{title}” is due in {days} day{'s' if days != 1 else ''}{owner_text}."


class NotificationListView(APIView):
    permission_classes = [IsOrgMember]

    def get(self, request):
        member = current_member(request)
        sync_notifications(member.org)
        today = today_in(member.org.timezone)

        items = (
            member.notifications.select_related("occurrence__obligation__owner__user", "occurrence__completed_by__user")
            .filter(occurrence__obligation__archived_at__isnull=True)[:LIST_LIMIT]
        )
        return Response({
            "unread_count": active_unread(member).count(),
            "items": [
                {
                    "id": n.id,
                    "kind": n.kind,
                    "message": describe(n, today, member.id),
                    "occurrence_id": n.occurrence_id,
                    "due_date": n.occurrence.due_date.isoformat(),
                    "resolved": n.occurrence.completed_at is not None,
                    "read": n.read_at is not None,
                    "created_at": n.created_at.isoformat(),
                }
                for n in items
            ],
        })


class NotificationReadView(APIView):
    permission_classes = [IsOrgMember]

    def post(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, recipient=current_member(request))
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationReadAllView(APIView):
    permission_classes = [IsOrgMember]

    def post(self, request):
        current_member(request).notifications.filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)

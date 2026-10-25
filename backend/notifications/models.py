from django.db import models

from compliance.models import Occurrence
from orgs.models import Member


class Notification(models.Model):
    """An in-app alert about a due item, shown under the bell in the top bar.

    No email or messaging service: notifications are created when anyone in the
    organization opens the app (see notifications/services.py). The unique
    constraint means re-running that check never creates a duplicate.
    """

    class Kind(models.TextChoices):
        REMINDER = "reminder", "Reminder before due date"
        OVERDUE = "overdue", "Overdue alert"

    occurrence = models.ForeignKey(Occurrence, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    recipient = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="notifications")
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["occurrence", "kind", "recipient"], name="one_notification_per_occurrence_kind_recipient"
            ),
        ]
        indexes = [models.Index(fields=["recipient", "read_at"])]

    def __str__(self) -> str:
        return f"{self.get_kind_display()} → {self.recipient}"

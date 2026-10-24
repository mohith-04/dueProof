from django.db import models

from compliance.models import Occurrence
from orgs.models import Member


class Notification(models.Model):
    """One email we sent (or tried to send) about an occurrence.

    The unique constraint is what makes the daily job idempotent: the row is
    created before sending, so a second run finds it and doesn't email again.
    """

    class Kind(models.TextChoices):
        REMINDER = "reminder", "Reminder before due date"
        OVERDUE = "overdue", "Overdue alert"

    occurrence = models.ForeignKey(Occurrence, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    recipient = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="notifications")
    recipient_email = models.EmailField()  # the address used at send time
    sent_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True)  # last failure; the next run retries unsent rows
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["occurrence", "kind", "recipient"], name="one_notification_per_occurrence_kind_recipient"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.get_kind_display()} → {self.recipient_email}"

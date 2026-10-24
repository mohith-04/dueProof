import uuid

from django.core.validators import MaxValueValidator
from django.db import models

from compliance.validators import validate_rrule
from orgs.models import Member, Organization


class Obligation(models.Model):
    """A recurring task the team must do and be able to prove, e.g. "Quarterly access review".

    The schedule is an RRULE (RFC 5545), e.g. FREQ=MONTHLY;BYMONTHDAY=20 or
    FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=-1 (last day of every quarter).
    Each due date becomes an Occurrence.
    """

    class Category(models.TextChoices):
        FINANCE = "finance", "Finance & tax"
        SECURITY = "security", "IT & security"
        HR = "hr", "HR & people"
        LEGAL = "legal", "Legal & licences"
        OPERATIONS = "operations", "Operations & safety"
        OTHER = "other", "Other"

    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="obligations")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    owner = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="owned_obligations")
    rrule = models.CharField(max_length=255, validators=[validate_rrule])
    start_date = models.DateField()
    remind_days_before = models.PositiveSmallIntegerField(default=7, validators=[MaxValueValidator(365)])
    evidence_required = models.BooleanField(default=True)
    # Obligations are archived, never deleted, so past occurrences and evidence keep their history.
    archived_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]
        indexes = [models.Index(fields=["org", "archived_at"])]

    def __str__(self) -> str:
        return self.title


class Occurrence(models.Model):
    """One due instance of an obligation, e.g. "Quarterly access review, due 2026-12-31".

    Status (completed / overdue / due soon / upcoming) is derived from these fields and
    the org's "today", never stored, so it can't go stale overnight.
    """

    obligation = models.ForeignKey(Obligation, on_delete=models.CASCADE, related_name="occurrences")
    due_date = models.DateField()
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    completion_note = models.TextField(blank=True)

    class Meta:
        ordering = ["due_date"]
        constraints = [
            # Regenerating a schedule twice can never create duplicate due dates.
            models.UniqueConstraint(fields=["obligation", "due_date"], name="unique_occurrence_per_due_date"),
        ]
        indexes = [models.Index(fields=["due_date", "completed_at"])]

    def __str__(self) -> str:
        return f"{self.obligation.title} — due {self.due_date:%Y-%m-%d}"

    @property
    def is_completed(self) -> bool:
        return self.completed_at is not None


def evidence_upload_path(instance: "Evidence", filename: str) -> str:
    # org/occurrence/random-prefix_original-name: grouped per org, never overwrites another file.
    org_id = instance.occurrence.obligation.org_id
    return f"evidence/{org_id}/{instance.occurrence_id}/{uuid.uuid4().hex[:8]}_{filename}"


class Evidence(models.Model):
    """Proof attached to an occurrence: a filing receipt, signed review, test result..."""

    occurrence = models.ForeignKey(Occurrence, on_delete=models.CASCADE, related_name="evidence")
    file = models.FileField(upload_to=evidence_upload_path, max_length=500)
    file_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size_bytes = models.PositiveIntegerField()
    uploaded_by = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, related_name="+")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["uploaded_at"]
        verbose_name_plural = "evidence"

    def __str__(self) -> str:
        return self.file_name


class AuditLog(models.Model):
    """Append-only record of who changed what and when.

    Written by the service layer in the same transaction as the change itself.
    Rows can be created but never edited or deleted through the app.
    """

    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="audit_logs")
    actor = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, related_name="+")
    action = models.CharField(max_length=50)  # e.g. "obligation.created", "occurrence.completed"
    entity_type = models.CharField(max_length=30)  # "obligation" | "occurrence" | "evidence"
    entity_id = models.PositiveBigIntegerField()
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["entity_type", "entity_id"])]

    def __str__(self) -> str:
        return f"{self.action} #{self.entity_id}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValueError("Audit log entries are append-only and cannot be changed.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Audit log entries are append-only and cannot be deleted.")

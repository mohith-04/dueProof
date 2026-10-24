from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from compliance.models import AuditLog, Obligation, Occurrence
from compliance.schedule_text import describe_rrule
from compliance.status import occurrence_status
from orgs.models import Member


class PersonSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name")

    class Meta:
        model = Member
        fields = ["id", "name"]


class ObligationSerializer(serializers.ModelSerializer):
    """Read shape used by lists and details; also validates create/update input."""

    owner = PersonSerializer(read_only=True)
    owner_id = serializers.PrimaryKeyRelatedField(
        source="owner",
        queryset=Member.objects.none(),
        write_only=True,
        error_messages={"does_not_exist": "Choose a member of your organization.", "incorrect_type": "Choose an owner."},
    )
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    schedule = serializers.SerializerMethodField()
    next_due = serializers.SerializerMethodField()

    class Meta:
        model = Obligation
        fields = [
            "id", "title", "description", "category", "category_label", "owner", "owner_id",
            "rrule", "schedule", "start_date", "remind_days_before", "evidence_required",
            "archived_at", "next_due", "created_at", "updated_at",
        ]
        read_only_fields = ["archived_at", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        org = self.context.get("org")
        if org is not None:
            # Owners can only be picked from the same organization.
            self.fields["owner_id"].queryset = org.members.all()

    def get_schedule(self, obligation) -> str:
        return describe_rrule(obligation.rrule, obligation.start_date.day, obligation.start_date.month)

    def get_next_due(self, obligation):
        """Earliest open due date (may be in the past, i.e. overdue)."""
        if hasattr(obligation, "next_due"):  # annotated by the list view: no extra query per row
            next_open = obligation.next_due
        else:
            first = obligation.occurrences.filter(completed_at__isnull=True).order_by("due_date").first()
            next_open = first.due_date if first else None
        return next_open.isoformat() if next_open else None

    def validate_rrule(self, value):
        from compliance.validators import validate_rrule
        try:
            validate_rrule(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value.upper().removeprefix("RRULE:")


class OccurrenceSerializer(serializers.ModelSerializer):
    """An occurrence plus its derived status; needs context['today']."""

    status = serializers.SerializerMethodField()
    days_until_due = serializers.SerializerMethodField()
    obligation = serializers.SerializerMethodField()
    owner = serializers.SerializerMethodField()
    evidence_count = serializers.IntegerField(read_only=True, default=0)
    completed_by = PersonSerializer(read_only=True)

    class Meta:
        model = Occurrence
        fields = [
            "id", "due_date", "status", "days_until_due", "obligation", "owner",
            "evidence_count", "completed_at", "completed_by", "completion_note",
        ]

    def get_status(self, occurrence) -> str:
        return occurrence_status(
            due_date=occurrence.due_date,
            completed=occurrence.is_completed,
            remind_days_before=occurrence.obligation.remind_days_before,
            today=self.context["today"],
        ).value

    def get_days_until_due(self, occurrence) -> int:
        return (occurrence.due_date - self.context["today"]).days

    def get_obligation(self, occurrence) -> dict:
        ob = occurrence.obligation
        return {
            "id": ob.id, "title": ob.title, "category": ob.category,
            "category_label": ob.get_category_display(), "evidence_required": ob.evidence_required,
        }

    def get_owner(self, occurrence) -> dict:
        return PersonSerializer(occurrence.obligation.owner).data


class AuditLogSerializer(serializers.ModelSerializer):
    actor = PersonSerializer(read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "action", "entity_type", "entity_id", "actor", "before", "after", "created_at"]

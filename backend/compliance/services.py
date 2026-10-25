"""All writes to obligations go through these functions.

Each one runs in a single database transaction and records an AuditLog entry in
that same transaction: either the change and its audit entry are both saved, or
neither is. Views never call .save() on these models directly.
"""

from datetime import date

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from compliance.models import AuditLog, Evidence, Obligation, Occurrence
from compliance.recurrence import generate_occurrences, regenerate_future
from compliance.status import today_in
from orgs.models import Member

EDITABLE_FIELDS = [
    "title",
    "description",
    "category",
    "owner",
    "rrule",
    "start_date",
    "remind_days_before",
    "evidence_required",
]
SCHEDULE_FIELDS = {"rrule", "start_date"}


def snapshot(obligation: Obligation) -> dict:
    """JSON-safe copy of the fields we audit."""
    return {
        "title": obligation.title,
        "description": obligation.description,
        "category": obligation.category,
        "owner_id": obligation.owner_id,
        "rrule": obligation.rrule,
        "start_date": obligation.start_date.isoformat() if obligation.start_date else None,
        "remind_days_before": obligation.remind_days_before,
        "evidence_required": obligation.evidence_required,
        "archived_at": obligation.archived_at.isoformat() if obligation.archived_at else None,
    }


def record_audit(*, org, actor: Member | None, action: str, entity_type: str, entity_id: int, before=None, after=None):
    return AuditLog.objects.create(
        org=org,
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before=before,
        after=after,
    )


def _check_owner(org, owner: Member) -> None:
    if owner.org_id != org.id:
        raise ValidationError({"owner": "The owner must be a member of this organization."})


@transaction.atomic
def create_obligation(*, actor: Member, today: date | None = None, **fields) -> Obligation:
    org = actor.org
    _check_owner(org, fields["owner"])

    obligation = Obligation(org=org, created_by=actor, **fields)
    obligation.full_clean()
    obligation.save()

    generate_occurrences(obligation, today or today_in(org.timezone))
    record_audit(
        org=org, actor=actor, action="obligation.created",
        entity_type="obligation", entity_id=obligation.id, after=snapshot(obligation),
    )
    return obligation


@transaction.atomic
def update_obligation(obligation: Obligation, *, actor: Member, today: date | None = None, **changes) -> Obligation:
    unknown = set(changes) - set(EDITABLE_FIELDS)
    if unknown:
        raise ValueError(f"These fields can't be edited: {', '.join(sorted(unknown))}")
    if "owner" in changes:
        _check_owner(obligation.org, changes["owner"])

    before = snapshot(obligation)
    for field, value in changes.items():
        setattr(obligation, field, value)
    obligation.full_clean()
    obligation.save()

    after = snapshot(obligation)
    if before == after:
        return obligation  # nothing actually changed: no audit noise

    if any(before[f] != after[f] for f in SCHEDULE_FIELDS):
        regenerate_future(obligation, today or today_in(obligation.org.timezone))

    record_audit(
        org=obligation.org, actor=actor, action="obligation.updated",
        entity_type="obligation", entity_id=obligation.id, before=before, after=after,
    )
    return obligation


@transaction.atomic
def archive_obligation(obligation: Obligation, *, actor: Member, today: date | None = None) -> Obligation:
    if obligation.archived_at is not None:
        return obligation
    before = snapshot(obligation)
    obligation.archived_at = timezone.now()
    obligation.save(update_fields=["archived_at", "updated_at"])

    # Removes future open items; history and anything with evidence stays.
    regenerate_future(obligation, today or today_in(obligation.org.timezone))

    record_audit(
        org=obligation.org, actor=actor, action="obligation.archived",
        entity_type="obligation", entity_id=obligation.id, before=before, after=snapshot(obligation),
    )
    return obligation


# --- Evidence and completion ---------------------------------------------------
# The owner of an obligation (or any admin) works on its occurrences. Proof can be
# added or removed only while an item is open; once done, the record is frozen
# until an admin reopens it.

class NotAllowed(Exception):
    """The member may not perform this action on this item."""


def can_work_on(member: Member, occurrence: Occurrence) -> bool:
    return member.is_admin or occurrence.obligation.owner_id == member.id


def _require_open_and_allowed(member: Member, occurrence: Occurrence) -> None:
    if not can_work_on(member, occurrence):
        raise NotAllowed("Only the owner of this obligation or an admin can do this.")
    if occurrence.is_completed:
        raise ValidationError("This item is already done. An admin can reopen it to make changes.")


@transaction.atomic
def add_evidence(occurrence: Occurrence, *, actor: Member, uploaded_file) -> Evidence:
    _require_open_and_allowed(actor, occurrence)
    evidence = Evidence(
        occurrence=occurrence,
        file_name=uploaded_file.name[:255],
        content_type=(uploaded_file.content_type or "application/octet-stream")[:100],
        size_bytes=uploaded_file.size,
        uploaded_by=actor,
    )
    evidence.file.save(uploaded_file.name, uploaded_file, save=False)
    evidence.save()
    record_audit(
        org=occurrence.obligation.org, actor=actor, action="evidence.uploaded", entity_type="occurrence",
        entity_id=occurrence.id, after={"file_name": evidence.file_name, "size_bytes": evidence.size_bytes},
    )
    return evidence


@transaction.atomic
def remove_evidence(evidence: Evidence, *, actor: Member) -> None:
    occurrence = evidence.occurrence
    _require_open_and_allowed(actor, occurrence)
    record_audit(
        org=occurrence.obligation.org, actor=actor, action="evidence.removed", entity_type="occurrence",
        entity_id=occurrence.id, before={"file_name": evidence.file_name},
    )
    stored_name = evidence.file.name
    evidence.delete()
    # Delete the stored file only after the database change is committed.
    transaction.on_commit(lambda: evidence.file.storage.delete(stored_name))


@transaction.atomic
def complete_occurrence(occurrence: Occurrence, *, actor: Member, note: str = "") -> Occurrence:
    occurrence = Occurrence.objects.select_for_update().select_related("obligation__org").get(pk=occurrence.pk)
    _require_open_and_allowed(actor, occurrence)
    if occurrence.obligation.evidence_required and not occurrence.evidence.exists():
        raise ValidationError("Attach proof before marking this done. This obligation requires evidence.")

    occurrence.completed_at = timezone.now()
    occurrence.completed_by = actor
    occurrence.completion_note = note.strip()
    occurrence.save(update_fields=["completed_at", "completed_by", "completion_note"])
    record_audit(
        org=occurrence.obligation.org, actor=actor, action="occurrence.completed", entity_type="occurrence",
        entity_id=occurrence.id,
        after={"due_date": occurrence.due_date.isoformat(), "note": occurrence.completion_note,
               "evidence": list(occurrence.evidence.values_list("file_name", flat=True))},
    )
    return occurrence


@transaction.atomic
def reopen_occurrence(occurrence: Occurrence, *, actor: Member, reason: str = "") -> Occurrence:
    if not actor.is_admin:
        raise NotAllowed("Only admins can reopen a completed item.")
    occurrence = Occurrence.objects.select_for_update().select_related("obligation__org").get(pk=occurrence.pk)
    if not occurrence.is_completed:
        return occurrence
    before = {"completed_at": occurrence.completed_at.isoformat(), "completed_by_id": occurrence.completed_by_id,
              "note": occurrence.completion_note}
    occurrence.completed_at = None
    occurrence.completed_by = None
    occurrence.completion_note = ""
    occurrence.save(update_fields=["completed_at", "completed_by", "completion_note"])
    record_audit(
        org=occurrence.obligation.org, actor=actor, action="occurrence.reopened", entity_type="occurrence",
        entity_id=occurrence.id, before=before, after={"reason": reason.strip()},
    )
    return occurrence

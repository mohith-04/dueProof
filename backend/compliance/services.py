"""All writes to obligations go through these functions.

Each one runs in a single database transaction and records an AuditLog entry in
that same transaction: either the change and its audit entry are both saved, or
neither is. Views never call .save() on these models directly.
"""

from datetime import date

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from compliance.models import AuditLog, Obligation
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

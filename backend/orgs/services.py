"""Creating accounts. Each function is one transaction: user, org and member are
created together or not at all."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from compliance.services import record_audit
from orgs.models import Invite, Member, Organization

User = get_user_model()


def _create_user(*, email: str, name: str, password: str):
    first, _, last = name.strip().partition(" ")
    # The email doubles as the username, so login is by email.
    return User.objects.create_user(username=email, email=email, password=password, first_name=first, last_name=last)


@transaction.atomic
def sign_up(*, name: str, email: str, password: str, org_name: str, timezone_name: str) -> Member:
    """Self-serve signup: the person who creates an organization becomes its first admin."""
    user = _create_user(email=email, name=name, password=password)
    org = Organization.objects.create(name=org_name.strip(), timezone=timezone_name)
    member = Member.objects.create(org=org, user=user, role=Member.Role.ADMIN)
    record_audit(org=org, actor=member, action="org.created", entity_type="organization", entity_id=org.id,
                 after={"name": org.name, "timezone": org.timezone})
    return member


@transaction.atomic
def accept_invite(invite: Invite, *, name: str, password: str) -> Member:
    # Lock the row so the same link can't be used twice at the same moment.
    invite = Invite.objects.select_for_update().get(pk=invite.pk)
    if not invite.is_valid:
        raise ValueError("This invite has expired or was already used.")

    user = _create_user(email=invite.email, name=name, password=password)
    member = Member.objects.create(org=invite.org, user=user, role=invite.role)
    invite.accepted_at = timezone.now()
    invite.save(update_fields=["accepted_at"])
    record_audit(org=invite.org, actor=member, action="member.joined", entity_type="member", entity_id=member.id,
                 after={"email": invite.email, "role": invite.role})
    return member

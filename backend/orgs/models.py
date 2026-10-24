import hashlib
import secrets
from datetime import timedelta
from zoneinfo import available_timezones

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def validate_timezone(value: str) -> None:
    if value not in available_timezones():
        raise ValidationError(f"'{value}' is not a valid timezone, e.g. Asia/Kolkata.")


class Organization(models.Model):
    """A team using DueProof. Every piece of data belongs to exactly one organization."""

    name = models.CharField(max_length=120)
    # Due dates are calendar days in this timezone ("due today" means today here).
    timezone = models.CharField(max_length=64, default="Asia/Kolkata", validators=[validate_timezone])
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class Member(models.Model):
    """Links a login (Django user) to an organization with a role.

    v1 rule: one user belongs to one organization, hence the OneToOneField.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="members")
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="member")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["user__first_name", "user__email"]

    def __str__(self) -> str:
        return f"{self.display_name} ({self.get_role_display()}, {self.org})"

    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def display_name(self) -> str:
        return self.user.get_full_name() or self.user.email or self.user.username


def hash_token(token: str) -> str:
    """Invite tokens are stored hashed, so a database leak can't be used to join an org."""
    return hashlib.sha256(token.encode()).hexdigest()


class Invite(models.Model):
    """An admin invites someone by email; the link carries a one-time token."""

    VALID_FOR = timedelta(days=7)

    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invites")
    email = models.EmailField()
    role = models.CharField(max_length=10, choices=Member.Role.choices, default=Member.Role.MEMBER)
    token_hash = models.CharField(max_length=64, unique=True, editable=False)
    invited_by = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, related_name="+")
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Invite {self.email} → {self.org}"

    @classmethod
    def create(cls, *, org: Organization, email: str, role: str, invited_by: Member | None) -> tuple["Invite", str]:
        """Create an invite and return it with the raw token (shown/emailed once, never stored)."""
        token = secrets.token_urlsafe(32)
        invite = cls.objects.create(
            org=org,
            email=email.strip().lower(),
            role=role,
            token_hash=hash_token(token),
            invited_by=invited_by,
            expires_at=timezone.now() + cls.VALID_FOR,
        )
        return invite, token

    @classmethod
    def find_valid(cls, token: str) -> "Invite | None":
        invite = cls.objects.filter(token_hash=hash_token(token)).select_related("org").first()
        return invite if invite and invite.is_valid else None

    @property
    def is_valid(self) -> bool:
        return self.accepted_at is None and timezone.now() < self.expires_at

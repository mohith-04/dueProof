"""Who may call what.

Every API view (except auth and health) uses IsOrgMember, and every query is
filtered by request.user.member.org. That pair is what keeps one organization's
data invisible to every other organization.
"""

from rest_framework.permissions import BasePermission

from orgs.models import Member


def current_member(request) -> Member | None:
    user = request.user
    if not user.is_authenticated:
        return None
    return getattr(user, "member", None)


class IsOrgMember(BasePermission):
    message = "You need to belong to an organization to do this."

    def has_permission(self, request, view) -> bool:
        return current_member(request) is not None


class IsOrgAdmin(BasePermission):
    message = "Only organization admins can do this."

    def has_permission(self, request, view) -> bool:
        member = current_member(request)
        return member is not None and member.is_admin

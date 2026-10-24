"""Auth and organization API.

/api/auth/csrf/                    GET   sets the CSRF cookie the React app sends back on writes
/api/auth/signup/                  POST  create account + organization, logged in as its admin
/api/auth/login/                   POST  email + password
/api/auth/logout/                  POST
/api/auth/me/                      GET   current member + organization (403 when logged out)
/api/auth/invites/<token>/         GET   check an invite link before showing the join form
/api/auth/invites/<token>/accept/  POST  name + password, joins the org and logs in
/api/org/                          GET/PATCH  organization settings (PATCH: admins only)
/api/org/members/                  GET   people in the organization (for owner pickers)
/api/org/invites/                  GET/POST  pending invites; POST returns the one-time link path (admins only)
"""

from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from orgs.models import Invite
from orgs.permissions import IsOrgAdmin, IsOrgMember, current_member
from orgs.serializers import (
    InviteCreateSerializer,
    InviteSerializer,
    LoginSerializer,
    MemberSerializer,
    NewAccountFields,
    OrganizationSerializer,
    SignupSerializer,
    me_payload,
)
from orgs.services import accept_invite, sign_up


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"detail": "CSRF cookie set."})


# DRF skips CSRF checks for logged-out requests; csrf_protect turns them back on
# for the endpoints that log someone in, which blocks login-CSRF attacks.
@method_decorator(csrf_protect, name="dispatch")
class SignupView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        member = sign_up(
            name=data["name"], email=data["email"], password=data["password"],
            org_name=data["org_name"], timezone_name=data["timezone"],
        )
        login(request, member.user)
        return Response(me_payload(member), status=status.HTTP_201_CREATED)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        member = getattr(user, "member", None) if user else None
        if member is None:
            # Same message whether the email or the password is wrong.
            return Response({"detail": "Incorrect email or password."}, status=status.HTTP_400_BAD_REQUEST)
        login(request, user)
        return Response(me_payload(member))


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsOrgMember]

    def get(self, request):
        return Response(me_payload(current_member(request)))


class InviteDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        invite = Invite.find_valid(token)
        if invite is None:
            return Response({"detail": "This invite link has expired or was already used."}, status=404)
        return Response({"org_name": invite.org.name, "email": invite.email, "role": invite.role})


@method_decorator(csrf_protect, name="dispatch")
class InviteAcceptView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request, token):
        invite = Invite.find_valid(token)
        if invite is None:
            return Response({"detail": "This invite link has expired or was already used."}, status=404)
        serializer = NewAccountFields(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            member = accept_invite(invite, **serializer.validated_data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=404)
        login(request, member.user)
        return Response(me_payload(member), status=status.HTTP_201_CREATED)


class OrganizationView(APIView):
    permission_classes = [IsOrgMember]

    def get(self, request):
        return Response(OrganizationSerializer(current_member(request).org).data)

    def patch(self, request):
        member = current_member(request)
        if not member.is_admin:
            return Response({"detail": IsOrgAdmin.message}, status=status.HTTP_403_FORBIDDEN)
        serializer = OrganizationSerializer(member.org, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MemberListView(APIView):
    permission_classes = [IsOrgMember]

    def get(self, request):
        members = current_member(request).org.members.select_related("user")
        return Response(MemberSerializer(members, many=True).data)


class InviteListView(APIView):
    permission_classes = [IsOrgAdmin]

    def get(self, request):
        invites = current_member(request).org.invites.all()
        return Response(InviteSerializer(invites, many=True).data)

    def post(self, request):
        member = current_member(request)
        serializer = InviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite, token = Invite.create(org=member.org, invited_by=member, **serializer.validated_data)
        # The raw token exists only in this response; the database keeps a hash.
        # Only the path is returned: the React app adds its own origin, which is correct in
        # development (Vite on :5173) and production alike, while Django's host may differ.
        return Response({**InviteSerializer(invite).data, "invite_path": f"/invite/{token}"}, status=status.HTTP_201_CREATED)

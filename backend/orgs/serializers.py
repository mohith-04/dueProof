from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from orgs.models import Invite, Member, Organization, validate_timezone

User = get_user_model()


class OrganizationSerializer(serializers.ModelSerializer):
    timezone = serializers.CharField(max_length=64, validators=[validate_timezone])

    class Meta:
        model = Organization
        fields = ["id", "name", "timezone"]

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Enter a name.")
        return value.strip()


class MemberSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Member
        fields = ["id", "name", "email", "role"]


def me_payload(member: Member) -> dict:
    """What the React app needs to know about the logged-in person."""
    return {
        "member": MemberSerializer(member).data,
        "org": OrganizationSerializer(member.org).data,
    }


class EmailField(serializers.EmailField):
    def to_internal_value(self, data):
        return super().to_internal_value(data).strip().lower()


class NewAccountFields(serializers.Serializer):
    """Name + password rules shared by signup and invite acceptance."""

    name = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_password(self, value):
        validate_password(value)  # Django's length / common-password / numeric checks
        return value


class SignupSerializer(NewAccountFields):
    email = EmailField()
    org_name = serializers.CharField(max_length=120)
    timezone = serializers.CharField(max_length=64, default="Asia/Kolkata", validators=[validate_timezone])

    def validate_email(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("An account with this email already exists. Log in instead.")
        return value


class LoginSerializer(serializers.Serializer):
    email = EmailField()
    password = serializers.CharField(write_only=True)


class InviteCreateSerializer(serializers.Serializer):
    email = EmailField()
    role = serializers.ChoiceField(choices=Member.Role.choices, default=Member.Role.MEMBER)

    def validate_email(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("This person already has a DueProof account.")
        return value


class InviteSerializer(serializers.ModelSerializer):
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = Invite
        fields = ["id", "email", "role", "expires_at", "accepted_at", "is_valid", "created_at"]

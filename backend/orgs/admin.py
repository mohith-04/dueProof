from django.contrib import admin

from orgs.models import Invite, Member, Organization


class MemberInline(admin.TabularInline):
    model = Member
    extra = 0
    raw_id_fields = ["user"]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "timezone", "created_at"]
    search_fields = ["name"]
    inlines = [MemberInline]


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ["display_name", "org", "role", "created_at"]
    list_filter = ["role", "org"]
    search_fields = ["user__email", "user__first_name", "user__last_name"]
    raw_id_fields = ["user"]


@admin.register(Invite)
class InviteAdmin(admin.ModelAdmin):
    list_display = ["email", "org", "role", "expires_at", "accepted_at"]
    list_filter = ["org"]
    readonly_fields = ["token_hash"]

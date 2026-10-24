from django.contrib import admin

from compliance.models import AuditLog, Evidence, Obligation, Occurrence


class OccurrenceInline(admin.TabularInline):
    model = Occurrence
    extra = 0
    fields = ["due_date", "completed_at", "completed_by"]
    readonly_fields = fields
    can_delete = False
    show_change_link = True


@admin.register(Obligation)
class ObligationAdmin(admin.ModelAdmin):
    list_display = ["title", "org", "category", "owner", "rrule", "evidence_required", "archived_at"]
    list_filter = ["org", "category", "evidence_required"]
    search_fields = ["title"]
    inlines = [OccurrenceInline]


class EvidenceInline(admin.TabularInline):
    model = Evidence
    extra = 0
    readonly_fields = ["file_name", "content_type", "size_bytes", "uploaded_by", "uploaded_at"]
    fields = readonly_fields
    can_delete = False


@admin.register(Occurrence)
class OccurrenceAdmin(admin.ModelAdmin):
    list_display = ["obligation", "due_date", "completed_at", "completed_by"]
    list_filter = ["obligation__org"]
    date_hierarchy = "due_date"
    inlines = [EvidenceInline]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Read-only: nobody, not even staff, can add, edit or delete audit entries here."""

    list_display = ["created_at", "org", "actor", "action", "entity_type", "entity_id"]
    list_filter = ["org", "action", "entity_type"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

from django.contrib import admin

from notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["created_at", "kind", "recipient", "occurrence", "read_at"]
    list_filter = ["kind", "occurrence__obligation__org"]
    readonly_fields = ["occurrence", "kind", "recipient", "read_at", "created_at"]

    def has_add_permission(self, request):
        return False

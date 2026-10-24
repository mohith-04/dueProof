from django.contrib import admin

from notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["created_at", "kind", "recipient_email", "occurrence", "sent_at", "error"]
    list_filter = ["kind", "occurrence__obligation__org"]
    readonly_fields = ["occurrence", "kind", "recipient", "recipient_email", "sent_at", "error", "created_at"]

    def has_add_permission(self, request):
        return False

from django.urls import path

from notifications import views

urlpatterns = [
    path("", views.NotificationListView.as_view(), name="notification-list"),
    path("read-all/", views.NotificationReadAllView.as_view(), name="notification-read-all"),
    path("<int:pk>/read/", views.NotificationReadView.as_view(), name="notification-read"),
]

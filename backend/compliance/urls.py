from django.urls import path

from compliance import views

urlpatterns = [
    path("obligations/", views.ObligationListView.as_view(), name="obligation-list"),
    path("obligations/preview/", views.SchedulePreviewView.as_view(), name="schedule-preview"),
    path("obligations/<int:pk>/", views.ObligationDetailView.as_view(), name="obligation-detail"),
    path("obligations/<int:pk>/archive/", views.ObligationArchiveView.as_view(), name="obligation-archive"),
    path("obligation-templates/", views.TemplateListView.as_view(), name="obligation-templates"),
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
]

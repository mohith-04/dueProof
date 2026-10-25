from django.urls import path

from compliance import report_views, views

urlpatterns = [
    path("obligations/", views.ObligationListView.as_view(), name="obligation-list"),
    path("obligations/preview/", views.SchedulePreviewView.as_view(), name="schedule-preview"),
    path("obligations/<int:pk>/", views.ObligationDetailView.as_view(), name="obligation-detail"),
    path("obligations/<int:pk>/archive/", views.ObligationArchiveView.as_view(), name="obligation-archive"),
    path("obligation-templates/", views.TemplateListView.as_view(), name="obligation-templates"),
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
    path("reports/", report_views.ReportView.as_view(), name="report"),
    path("reports/export.csv", report_views.ReportCsvView.as_view(), name="report-csv"),
    path("occurrences/<int:pk>/", views.OccurrenceDetailView.as_view(), name="occurrence-detail"),
    path("occurrences/<int:pk>/evidence/", views.EvidenceUploadView.as_view(), name="occurrence-evidence"),
    path("occurrences/<int:pk>/complete/", views.OccurrenceCompleteView.as_view(), name="occurrence-complete"),
    path("occurrences/<int:pk>/reopen/", views.OccurrenceReopenView.as_view(), name="occurrence-reopen"),
    path("evidence/<int:pk>/", views.EvidenceDetailView.as_view(), name="evidence-detail"),
    path("evidence/<int:pk>/download/", views.EvidenceDownloadView.as_view(), name="evidence-download"),
]

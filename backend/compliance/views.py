"""Obligations and dashboard API. Every query starts from the caller's own organization.

/api/obligations/                  GET (members)  list; filters ?category= ?owner=<id>|me ?archived=true
                                   POST (admins)  create from the form or a template
/api/obligations/<id>/             GET (members)  detail + upcoming + history + audit trail
                                   PATCH (admins) edit; a schedule change regenerates future due dates only
/api/obligations/<id>/archive/     POST (admins)  stop tracking; history is kept
/api/obligations/preview/          POST           {rrule, start_date} → plain-English schedule + next 5 due dates
/api/obligation-templates/         GET            starter examples for the create form
/api/dashboard/                    GET            open items grouped by status; ?mine=1 ?category=
"""

from datetime import date, timedelta

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Min, Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from compliance.models import AuditLog, Evidence, Obligation, Occurrence
from compliance.recurrence import due_dates, generate_occurrences
from compliance.serializers import AuditLogSerializer, EvidenceSerializer, ObligationSerializer, OccurrenceSerializer
from compliance.services import (
    NotAllowed,
    add_evidence,
    archive_obligation,
    can_work_on,
    complete_occurrence,
    create_obligation,
    remove_evidence,
    reopen_occurrence,
    update_obligation,
)
from compliance.schedule_text import describe_rrule
from compliance.status import Status, occurrence_status, today_in
from compliance.validators import validate_evidence_file, validate_rrule
from compliance.templates_catalog import TEMPLATES
from orgs.permissions import IsOrgAdmin, IsOrgMember, current_member

DASHBOARD_UPCOMING_DAYS = 45
DASHBOARD_RECENT_DAYS = 30


def raise_as_drf(exc: DjangoValidationError):
    """Model validation errors (full_clean) become normal 400 field errors."""
    raise serializers.ValidationError(exc.message_dict if hasattr(exc, "error_dict") else {"detail": exc.messages})


def occurrence_queryset():
    return Occurrence.objects.select_related(
        "obligation", "obligation__owner__user", "completed_by__user"
    ).annotate(evidence_count=Count("evidence"))


class ObligationListView(APIView):
    permission_classes = [IsOrgMember]

    def get_permissions(self):
        return [IsOrgAdmin()] if self.request.method == "POST" else super().get_permissions()

    def get(self, request):
        member = current_member(request)
        obligations = (
            member.org.obligations.select_related("owner__user")
            .annotate(next_due=Min("occurrences__due_date", filter=Q(occurrences__completed_at__isnull=True)))
            .order_by("title")
        )
        archived = request.query_params.get("archived") == "true"
        obligations = obligations.filter(archived_at__isnull=not archived)
        if category := request.query_params.get("category"):
            obligations = obligations.filter(category=category)
        if owner := request.query_params.get("owner"):
            obligations = obligations.filter(owner=member if owner == "me" else owner)
        return Response(ObligationSerializer(obligations, many=True, context={"org": member.org}).data)

    def post(self, request):
        member = current_member(request)
        serializer = ObligationSerializer(data=request.data, context={"org": member.org})
        serializer.is_valid(raise_exception=True)
        try:
            obligation = create_obligation(actor=member, **serializer.validated_data)
        except DjangoValidationError as exc:
            raise_as_drf(exc)
        return Response(ObligationSerializer(obligation, context={"org": member.org}).data, status=status.HTTP_201_CREATED)


class ObligationDetailView(APIView):
    permission_classes = [IsOrgMember]

    def get_permissions(self):
        return [IsOrgAdmin()] if self.request.method == "PATCH" else super().get_permissions()

    def get_object(self, request, pk) -> Obligation:
        # Filtering by org means another org's obligation is simply "not found".
        return get_object_or_404(Obligation.objects.select_related("owner__user", "org"), pk=pk, org=current_member(request).org)

    def get(self, request, pk):
        obligation = self.get_object(request, pk)
        today = today_in(obligation.org.timezone)
        occurrences = occurrence_queryset().filter(obligation=obligation)
        upcoming = occurrences.filter(completed_at__isnull=True, due_date__gte=today).order_by("due_date")[:6]
        history = occurrences.filter(Q(completed_at__isnull=False) | Q(due_date__lt=today)).order_by("-due_date")[:12]

        occurrence_ids = obligation.occurrences.values_list("id", flat=True)
        audit = (
            AuditLog.objects.filter(org=obligation.org)
            .filter(Q(entity_type="obligation", entity_id=obligation.id) | Q(entity_type="occurrence", entity_id__in=occurrence_ids))
            .select_related("actor__user")[:50]
        )
        context = {"org": obligation.org, "today": today}
        return Response({
            **ObligationSerializer(obligation, context=context).data,
            "upcoming": OccurrenceSerializer(upcoming, many=True, context=context).data,
            "history": OccurrenceSerializer(history, many=True, context=context).data,
            "audit": AuditLogSerializer(audit, many=True).data,
        })

    def patch(self, request, pk):
        member = current_member(request)
        obligation = self.get_object(request, pk)
        if obligation.archived_at:
            return Response({"detail": "Archived obligations can't be edited."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ObligationSerializer(obligation, data=request.data, partial=True, context={"org": member.org})
        serializer.is_valid(raise_exception=True)
        try:
            update_obligation(obligation, actor=member, **serializer.validated_data)
        except DjangoValidationError as exc:
            raise_as_drf(exc)
        return self.get(request, pk)


class ObligationArchiveView(APIView):
    permission_classes = [IsOrgAdmin]

    def post(self, request, pk):
        member = current_member(request)
        obligation = get_object_or_404(Obligation, pk=pk, org=member.org)
        archive_obligation(obligation, actor=member)
        return Response(ObligationSerializer(obligation, context={"org": member.org}).data)


class SchedulePreviewView(APIView):
    """Lets the form show the schedule in words and the next due dates before saving."""

    permission_classes = [IsOrgMember]

    def post(self, request):
        rule = str(request.data.get("rrule", ""))
        try:
            start = date.fromisoformat(str(request.data.get("start_date", "")))
        except ValueError:
            return Response({"start_date": ["Enter a valid date."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_rrule(rule)
        except DjangoValidationError as exc:
            return Response({"rrule": exc.messages}, status=status.HTTP_400_BAD_REQUEST)

        today = today_in(current_member(request).org.timezone)
        dates = due_dates(rule, start, today, today + timedelta(days=5 * 366))[:5]
        return Response({
            "schedule": describe_rrule(rule, start.day, start.month),
            "next_dates": [d.isoformat() for d in dates],
        })


class TemplateListView(APIView):
    permission_classes = [IsOrgMember]

    def get(self, request):
        return Response(TEMPLATES)


class DashboardView(APIView):
    """What needs attention, in order: overdue, due soon, then the next few weeks."""

    permission_classes = [IsOrgMember]

    def get(self, request):
        member = current_member(request)
        org = member.org
        today = today_in(org.timezone)

        # Keep every schedule filled up to a year ahead. Cheap, and a no-op when nothing is missing.
        for obligation in org.obligations.filter(archived_at__isnull=True):
            generate_occurrences(obligation, today)

        obligations = org.obligations.filter(archived_at__isnull=True)
        if request.query_params.get("mine") == "1":
            obligations = obligations.filter(owner=member)
        if category := request.query_params.get("category"):
            obligations = obligations.filter(category=category)
        occurrences = occurrence_queryset().filter(obligation__in=obligations)

        open_items = occurrences.filter(completed_at__isnull=True, due_date__lte=today + timedelta(days=DASHBOARD_UPCOMING_DAYS))
        recently_done = occurrences.filter(completed_at__date__gte=today - timedelta(days=DASHBOARD_RECENT_DAYS)).order_by("-completed_at")[:10]

        groups = {Status.OVERDUE: [], Status.DUE_SOON: [], Status.UPCOMING: []}
        for occurrence in open_items.order_by("due_date"):
            item_status = occurrence_status(
                due_date=occurrence.due_date, completed=False,
                remind_days_before=occurrence.obligation.remind_days_before, today=today,
            )
            groups[item_status].append(occurrence)

        # Upcoming shows only the next due date of each obligation, so a weekly task
        # doesn't fill the list with six copies of itself.
        seen: set[int] = set()
        next_per_obligation = []
        for occurrence in groups[Status.UPCOMING]:
            if occurrence.obligation_id not in seen:
                seen.add(occurrence.obligation_id)
                next_per_obligation.append(occurrence)
        groups[Status.UPCOMING] = next_per_obligation

        context = {"today": today}
        serialize = lambda items: OccurrenceSerializer(items, many=True, context=context).data  # noqa: E731
        return Response({
            "today": today.isoformat(),
            "counts": {
                "overdue": len(groups[Status.OVERDUE]),
                "due_soon": len(groups[Status.DUE_SOON]),
                "upcoming": len(groups[Status.UPCOMING]),
                "completed_last_30_days": occurrences.filter(completed_at__date__gte=today - timedelta(days=DASHBOARD_RECENT_DAYS)).count(),
                "active_obligations": obligations.count(),
            },
            "overdue": serialize(groups[Status.OVERDUE]),
            "due_soon": serialize(groups[Status.DUE_SOON]),
            "upcoming": serialize(groups[Status.UPCOMING]),
            "recently_completed": serialize(recently_done),
        })


# --- Occurrences: proof and completion -------------------------------------------
# /api/occurrences/<id>/            GET   one due item: obligation, proof files, activity, what you may do
# /api/occurrences/<id>/evidence/   POST  upload a proof file (multipart "file"), owner or admin, while open
# /api/occurrences/<id>/complete/   POST  {note}: mark done; refused without proof when proof is required
# /api/occurrences/<id>/reopen/     POST  {reason}: admins undo a completion
# /api/evidence/<id>/               DELETE remove a proof file while the item is open
# /api/evidence/<id>/download/      GET   stream the file after checking the caller's organization


def get_occurrence_for(request, pk) -> Occurrence:
    return get_object_or_404(occurrence_queryset().select_related("obligation__org"), pk=pk, obligation__org=current_member(request).org)


def service_errors(func):
    """Turn service-layer refusals into the right HTTP answers."""
    from functools import wraps

    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except NotAllowed as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except DjangoValidationError as exc:
            return Response({"detail": " ".join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

    return wrapper


class OccurrenceDetailView(APIView):
    permission_classes = [IsOrgMember]

    def get(self, request, pk):
        member = current_member(request)
        occurrence = get_occurrence_for(request, pk)
        org = occurrence.obligation.org
        today = today_in(org.timezone)
        audit = AuditLog.objects.filter(org=org, entity_type="occurrence", entity_id=occurrence.id).select_related("actor__user")
        evidence = occurrence.evidence.select_related("uploaded_by__user")
        return Response({
            **OccurrenceSerializer(occurrence, context={"today": today}).data,
            "obligation_detail": {
                "description": occurrence.obligation.description,
                "schedule": ObligationSerializer(occurrence.obligation, context={"org": org}).data["schedule"],
                "archived": occurrence.obligation.archived_at is not None,
            },
            "evidence": EvidenceSerializer(evidence, many=True).data,
            "activity": AuditLogSerializer(audit, many=True).data,
            "can_work_on": can_work_on(member, occurrence),
            "can_reopen": member.is_admin and occurrence.is_completed,
            "limits": {"max_bytes": settings.MAX_EVIDENCE_BYTES, "extensions": sorted(settings.EVIDENCE_EXTENSIONS)},
        })


class EvidenceUploadView(APIView):
    permission_classes = [IsOrgMember]
    parser_classes = [MultiPartParser]

    @service_errors
    def post(self, request, pk):
        occurrence = get_occurrence_for(request, pk)
        uploaded_file = request.FILES.get("file")
        validate_evidence_file(uploaded_file)
        evidence = add_evidence(occurrence, actor=current_member(request), uploaded_file=uploaded_file)
        return Response(EvidenceSerializer(evidence).data, status=status.HTTP_201_CREATED)


class OccurrenceCompleteView(APIView):
    permission_classes = [IsOrgMember]

    @service_errors
    def post(self, request, pk):
        occurrence = get_occurrence_for(request, pk)
        complete_occurrence(occurrence, actor=current_member(request), note=str(request.data.get("note", ""))[:2000])
        return OccurrenceDetailView().get(request, pk)


class OccurrenceReopenView(APIView):
    permission_classes = [IsOrgMember]

    @service_errors
    def post(self, request, pk):
        occurrence = get_occurrence_for(request, pk)
        reopen_occurrence(occurrence, actor=current_member(request), reason=str(request.data.get("reason", ""))[:500])
        return OccurrenceDetailView().get(request, pk)


def get_evidence_for(request, pk) -> Evidence:
    return get_object_or_404(
        Evidence.objects.select_related("occurrence__obligation__org"), pk=pk,
        occurrence__obligation__org=current_member(request).org,
    )


class EvidenceDetailView(APIView):
    permission_classes = [IsOrgMember]

    @service_errors
    def delete(self, request, pk):
        remove_evidence(get_evidence_for(request, pk), actor=current_member(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


class EvidenceDownloadView(APIView):
    permission_classes = [IsOrgMember]

    def get(self, request, pk):
        evidence = get_evidence_for(request, pk)
        try:
            handle = evidence.file.open("rb")
        except FileNotFoundError:
            return Response({"detail": "The stored file is missing."}, status=status.HTTP_404_NOT_FOUND)
        # as_attachment: always a download, never rendered inside our site.
        response = FileResponse(handle, as_attachment=True, filename=evidence.file_name, content_type="application/octet-stream")
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "private, no-store"
        return response

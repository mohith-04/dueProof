"""Obligations and dashboard API. Every query starts from the caller's own organization.

/api/obligations/                  GET (members)  list; filters ?category= ?owner=<id>|me ?archived=true
                                   POST (admins)  create from the form or a template
/api/obligations/<id>/             GET (members)  detail + upcoming + history + audit trail
                                   PATCH (admins) edit; a schedule change regenerates future due dates only
/api/obligations/<id>/archive/     POST (admins)  stop tracking; history is kept
/api/obligation-templates/         GET            starter examples for the create form
/api/dashboard/                    GET            open items grouped by status; ?mine=1 ?category=
"""

from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Min, Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from compliance.models import AuditLog, Obligation, Occurrence
from compliance.recurrence import generate_occurrences
from compliance.serializers import AuditLogSerializer, ObligationSerializer, OccurrenceSerializer
from compliance.services import archive_obligation, create_obligation, update_obligation
from compliance.status import Status, occurrence_status, today_in
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

"""Audit report for the caller's organization.

/api/reports/              GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD&category=&owner=&status=  → summary + rows
/api/reports/export.csv    GET  same filters → CSV download
"""

from django.http import HttpResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from compliance.reports import build_rows, parse_filters, summarize, to_csv
from compliance.status import today_in
from orgs.permissions import IsOrgMember, current_member

JSON_ROW_LIMIT = 1000


class ReportView(APIView):
    permission_classes = [IsOrgMember]

    def get(self, request):
        org = current_member(request).org
        today = today_in(org.timezone)
        filters, errors = parse_filters(request.query_params, today)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        rows = build_rows(org, filters, today)
        return Response({
            "filters": {"from": filters.date_from.isoformat(), "to": filters.date_to.isoformat(),
                        "category": filters.category, "owner": filters.owner_id, "status": filters.status},
            "today": today.isoformat(),
            "summary": summarize(rows),
            "rows": rows[:JSON_ROW_LIMIT],
            "truncated": len(rows) > JSON_ROW_LIMIT,
        })


class ReportCsvView(APIView):
    permission_classes = [IsOrgMember]

    def get(self, request):
        org = current_member(request).org
        today = today_in(org.timezone)
        filters, errors = parse_filters(request.query_params, today)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        rows = build_rows(org, filters, today)
        filename = f"compliance-report-{filters.date_from}-to-{filters.date_to}.csv"
        response = HttpResponse(to_csv(org, filters, rows), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Cache-Control"] = "private, no-store"
        return response

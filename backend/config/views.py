from django.conf import settings
from django.db import connection
from django.http import FileResponse, HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """Liveness check used by the deploy platform and the frontend.

    Runs a trivial query so a broken database connection shows up here
    instead of on the first real page load.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        database = "ok"
    except Exception:  # report the failure instead of raising a 500 page
        database = "error"

    status_code = 200 if database == "ok" else 503
    return Response({"status": "ok" if status_code == 200 else "degraded", "database": database}, status=status_code)


def spa_index(request):
    """Serve the React app for every page URL (/, /dashboard, /obligations/12, ...).

    React Router then decides what to show. API, admin and static URLs never
    reach this view (see config/urls.py).
    """
    index_file = settings.FRONTEND_DIST / "index.html"
    if not index_file.exists():
        return HttpResponse(
            "Frontend build not found. In development use the Vite server (npm run dev, port 5173); "
            "for production run npm run build in frontend/.",
            status=404,
            content_type="text/plain",
        )
    return FileResponse(index_file.open("rb"), content_type="text/html")

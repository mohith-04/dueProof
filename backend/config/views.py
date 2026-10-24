from django.db import connection
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

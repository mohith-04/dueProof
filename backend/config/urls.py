"""URL routing.

/api/...    JSON API used by the React app
/admin/...  Django admin
/static/... built assets (served by WhiteNoise)
anything else → the React app's index.html, so React Router handles the page
"""

from django.contrib import admin
from django.urls import include, path, re_path

from config.views import health, spa_index
from orgs.urls import auth_urlpatterns, org_urlpatterns

api_urlpatterns = [
    path("health/", health, name="health"),
    path("auth/", include(auth_urlpatterns)),
    path("org/", include(org_urlpatterns)),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api_urlpatterns)),
    re_path(r"^(?!api/|admin/|static/).*$", spa_index, name="spa"),
]

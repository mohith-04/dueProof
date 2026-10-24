"""URL routing.

/api/...    JSON API used by the React app
/admin/...  Django admin
/static/... built assets (served by WhiteNoise)
anything else → the React app's index.html, so React Router handles the page
"""

from django.contrib import admin
from django.urls import include, path, re_path

from config.views import health, spa_index

api_urlpatterns = [
    path("health/", health, name="health"),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api_urlpatterns)),
    re_path(r"^(?!api/|admin/|static/).*$", spa_index, name="spa"),
]

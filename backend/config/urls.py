"""URL routing.

Everything the React app calls lives under /api/. Django admin stays at /admin/.
In production, every other path will be served the React app (added in the deploy step).
"""

from django.contrib import admin
from django.urls import include, path

from config.views import health

api_urlpatterns = [
    path("health/", health, name="health"),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api_urlpatterns)),
]

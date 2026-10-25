"""
Django settings for DueProof.

Every value that differs between environments (secret key, debug flag,
database, allowed hosts) is read from environment variables. Locally they
come from backend/.env (copy .env.example); in production they are set on
the hosting platform. Nothing secret is ever committed.
"""

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CSRF_TRUSTED_ORIGINS=(list, []),
)

# Load backend/.env when it exists (local development only).
env_file = BASE_DIR / ".env"
if env_file.exists():
    environ.Env.read_env(env_file)

# The built React app (frontend/dist). Django serves its index.html for every
# non-API page and its assets as static files. Same layout locally and in Docker.
FRONTEND_DIST = Path(env("FRONTEND_DIST", default=str(BASE_DIR.parent / "frontend" / "dist")))

# --- Core -------------------------------------------------------------------

SECRET_KEY = env("SECRET_KEY")  # required: the app refuses to start without it
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env("CSRF_TRUSTED_ORIGINS")

# Hosting platforms expose the app's public domain as an env var; trust it automatically.
# Railway: RAILWAY_PUBLIC_DOMAIN (e.g. dueproof-production.up.railway.app). Render: RENDER_EXTERNAL_HOSTNAME.
PUBLIC_DOMAIN = env("RAILWAY_PUBLIC_DOMAIN", default="") or env("RENDER_EXTERNAL_HOSTNAME", default="")
if PUBLIC_DOMAIN:
    ALLOWED_HOSTS.append(PUBLIC_DOMAIN)
    CSRF_TRUSTED_ORIGINS.append(f"https://{PUBLIC_DOMAIN}")
# Railway's health checker calls the app with this Host header.
if env("RAILWAY_PUBLIC_DOMAIN", default=""):
    ALLOWED_HOSTS.append("healthcheck.railway.app")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    # Project apps
    "orgs",
    "compliance",
    "notifications",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # serves static files, incl. the React build
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# --- Database ---------------------------------------------------------------
# DATABASE_URL examples:
#   postgres://user:password@localhost:5432/dueproof   (local Postgres, CI, production)
#   sqlite:///db.sqlite3                                (quick local start)

DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
}
# Reuse connections for a minute instead of reconnecting on every request
# (each new connection to a hosted Postgres costs a network round trip).
DATABASES["default"]["CONN_MAX_AGE"] = env.int("CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Auth -------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- API (Django REST Framework) --------------------------------------------
# The React app is served from the same domain, so the API uses Django's
# session cookie + CSRF token. Every endpoint requires login unless it says otherwise.

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    # Login, signup and invite acceptance are rate-limited per client to slow password guessing.
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"auth": "10/minute"},
}

# Sessions last two weeks; the CSRF cookie must be readable by the React app's JavaScript.
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14
CSRF_COOKIE_HTTPONLY = False

# --- Time -------------------------------------------------------------------
# Timestamps are stored in UTC. "Today" for due dates is computed per
# organization from its own timezone (see compliance/status.py later).

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# --- Static files -----------------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# Vite builds with base "/static/", so dist/assets/x.js is served at /static/assets/x.js.
STATICFILES_DIRS = [FRONTEND_DIST] if FRONTEND_DIST.exists() else []
# --- Uploaded evidence files -------------------------------------------------
# Evidence is private: it is never served from a public URL, only streamed by
# /api/evidence/<id>/download/ after a permission check.
#
# Default: files on disk under MEDIA_ROOT. On Railway, attach a volume and set
# MEDIA_ROOT to a folder on it (e.g. /data/media) so files survive redeploys.
# Optional: set S3_BUCKET (+ keys) to use any S3-compatible bucket instead,
# e.g. Supabase Storage's S3 endpoint.

MEDIA_ROOT = Path(env("MEDIA_ROOT", default=str(BASE_DIR / "media")))
MAX_EVIDENCE_BYTES = 10 * 1024 * 1024  # 10 MB per file
EVIDENCE_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "csv", "txt", "xlsx", "docx"}

if env("S3_BUCKET", default=""):
    default_storage = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": env("S3_BUCKET"),
            "endpoint_url": env("S3_ENDPOINT_URL", default=None),
            "region_name": env("S3_REGION", default=None),
            "access_key": env("S3_ACCESS_KEY_ID"),
            "secret_key": env("S3_SECRET_ACCESS_KEY"),
            "default_acl": None,
            "querystring_auth": True,
            "file_overwrite": False,
        },
    }
else:
    default_storage = {"BACKEND": "django.core.files.storage.FileSystemStorage", "OPTIONS": {"location": MEDIA_ROOT}}

STORAGES = {
    "default": default_storage,
    # Vite already puts a content hash in every asset name, so plain compression is enough.
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

# --- Production security ----------------------------------------------------
# The platform terminates HTTPS and forwards requests to the app over HTTP with this header.

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

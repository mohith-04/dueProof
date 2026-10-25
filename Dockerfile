# One image for the whole app: build React with Node, then run it all from Django.

# --- Stage 1: build the React app -------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Django serves the API and the built React app -----------------
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./
# Same relative layout as in the repo, so settings.FRONTEND_DIST works unchanged.
COPY --from=frontend /app/frontend/dist /app/frontend/dist

# collectstatic only needs a placeholder key; the real one is set at runtime.
RUN SECRET_KEY=build-only python manage.py collectstatic --noinput

# The app runs as a non-root user; it needs one writable folder for uploaded evidence.
# (With a Railway volume, set MEDIA_ROOT to the volume path instead; see the README.)
RUN useradd --create-home appuser && mkdir -p /app/backend/media && chown appuser /app/backend/media
USER appuser

# Railway (or Render) provides $PORT. Migrations run on each start so the schema always matches the code.
# With SEED_DEMO=1, the demo organization is created on first start (skipped when it already exists).
CMD python manage.py migrate --noinput && \
    if [ "$SEED_DEMO" = "1" ]; then python manage.py seed_demo; fi && \
    gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 60 --access-logfile -

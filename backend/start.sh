#!/bin/sh
set -e

: "${PORT:=9000}"
: "${GUNICORN_WORKERS:=3}"
: "${GUNICORN_TIMEOUT:=60}"
: "${GUNICORN_KEEPALIVE:=5}"
: "${GUNICORN_MAX_REQUESTS:=1000}"
: "${GUNICORN_MAX_REQUESTS_JITTER:=100}"

cd /app

exec gunicorn app.main:app \
  --chdir /app \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:${PORT}" \
  --workers "${GUNICORN_WORKERS}" \
  --timeout "${GUNICORN_TIMEOUT}" \
  --keep-alive "${GUNICORN_KEEPALIVE}" \
  --max-requests "${GUNICORN_MAX_REQUESTS}" \
  --max-requests-jitter "${GUNICORN_MAX_REQUESTS_JITTER}" \
  --access-logfile - \
  --error-logfile -

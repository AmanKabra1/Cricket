#!/usr/bin/env sh
# Container start: run DB migrations, then boot the ASGI app on Render's $PORT
# (defaults to 8000 locally). Used by the Docker image CMD.
set -e

echo "Running database migrations…"
alembic upgrade head

echo "Starting LocalScore backend on port ${PORT:-8000}…"
exec uvicorn app.main:socket_app --host 0.0.0.0 --port "${PORT:-8000}"

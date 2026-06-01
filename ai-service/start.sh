#!/usr/bin/env sh
# Container start: boot the AI service on Render's $PORT (8100 locally).
set -e

echo "Starting LocalScore AI on port ${PORT:-8100}…"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8100}"

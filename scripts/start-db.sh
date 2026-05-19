#!/bin/bash
# Start baari-postgres Docker container if not already running.
# Usage: pnpm db:start
#
# On first run: creates the container + volume.
# On subsequent runs: starts the existing container (fast).
# If already running: exits immediately.

set -euo pipefail

CONTAINER=baari-postgres
IMAGE=postgres:16-alpine

echo "🗄️  Checking baari-postgres..."

# Already running — nothing to do
if docker ps --filter "name=^${CONTAINER}$" --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "✓ ${CONTAINER} already running"
  exit 0
fi

# Exists but stopped — just start it
if docker ps -a --filter "name=^${CONTAINER}$" --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "  Starting stopped container..."
  docker start "${CONTAINER}"
else
  # Doesn't exist — create it
  echo "  Creating ${CONTAINER}..."
  docker run -d \
    --name "${CONTAINER}" \
    -p 5432:5432 \
    -e POSTGRES_USER=baari \
    -e POSTGRES_PASSWORD=baari_dev \
    -e POSTGRES_DB=baari \
    -v baari-postgres-data:/var/lib/postgresql/data \
    "${IMAGE}"
fi

# Wait until postgres accepts connections
echo "  Waiting for postgres to be ready..."
until docker exec "${CONTAINER}" pg_isready -U baari -d baari -q 2>/dev/null; do
  sleep 1
done

echo "✓ ${CONTAINER} ready on localhost:5432"

#!/usr/bin/env bash
# Per-boot runtime reconciliation: bring up Docker + Neo4j and load the catalog.
# Must tolerate restarts, avoid duplicate processes, check readiness, then return.
set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Start the Docker daemon if it isn't already running (no systemd in the VM).
if ! sudo docker info >/dev/null 2>&1; then
  sudo rm -f /var/run/docker.pid
  sudo nohup dockerd >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 60); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
sudo docker info >/dev/null 2>&1 || { echo "dockerd failed to start" >&2; exit 1; }

# 2. Start (or reuse) the Neo4j container.
sudo docker compose up -d

# 3. Wait until Neo4j reports healthy (APOC download can take ~40s on a cold volume).
cid="$(sudo docker compose ps -q neo4j)"
for _ in $(seq 1 40); do
  status="$(sudo docker inspect --format '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo '')"
  [ "$status" = "healthy" ] && break
  sleep 3
done
[ "$status" = "healthy" ] || { echo "Neo4j did not become healthy" >&2; exit 1; }

# 4. Load the knowledge-base catalog into the graph (wipe-reload; idempotent).
npm run sync

echo "start.sh complete"

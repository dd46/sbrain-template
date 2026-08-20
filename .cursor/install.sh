#!/usr/bin/env bash
# Idempotent dependency + toolchain refresh for the Second Brain environment.
# Runs after the repo is checked out. Must terminate (no long-running processes here).
set -euo pipefail

cd "$(dirname "$0")/.."

export DEBIAN_FRONTEND=noninteractive
# Keep existing conffiles and never prompt (dpkg conffile prompts would hang a
# non-interactive build, e.g. on /etc/fuse.conf).
APT_INSTALL=(sudo apt-get install -y -qq
  -o Dpkg::Options::=--force-confold
  -o Dpkg::Options::=--force-confdef)

# Docker is required to run the Neo4j graph database. The Cloud Agent VM has no
# systemd, so the daemon is launched later from start.sh; here we only install it.
# fuse-overlayfs is the storage driver used inside the nested Cloud Agent VM
# (overlay2 is unavailable there).
sudo apt-get update -qq
"${APT_INSTALL[@]}" docker.io docker-compose-v2 fuse-overlayfs iptables

sudo mkdir -p /etc/docker
echo '{"storage-driver":"fuse-overlayfs"}' | sudo tee /etc/docker/daemon.json >/dev/null

# Node dependencies: root package + the Next.js chat UI under web/.
npm install
npm install --prefix web

# Pre-warm the local embedding model (~23 MB, Xenova/all-MiniLM-L6-v2) so the
# first `npm run sync` does not have to download it at runtime. The cache lives
# inside node_modules, so this must run after `npm install`.
node -e "import('./lib/embeddings.js').then(m => m.embed('warm up')).then(() => console.log('embedding model cached'))"

# Default local env for chat providers (values match docker-compose.yml).
[ -f .env ] || cp .env.example .env

echo "install.sh complete"

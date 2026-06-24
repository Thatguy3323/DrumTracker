#!/bin/bash
set -e

echo "==> Installing Python dependencies..."
# The Replit package-install wrapper auto-routes torch-dependent packages to the
# pytorch-cpu index. For `openunmix` that route is wrong (no openunmix wheel is
# hosted there), and it keeps getting re-added in task-agent environments, so it
# rides along into merges and breaks `uv` resolution. Strip the bad source route
# before syncing so every merge reconciles cleanly. The actual dependency stays
# declared as a quoted entry in [project].dependencies and is unaffected.
sed -i '/^openunmix = \[{/d' pyproject.toml
uv sync

echo "==> Installing frontend dependencies..."
cd frontend && npm install --legacy-peer-deps
cd ..

echo "==> Ensuring upload/conversion directories exist..."
mkdir -p backend/uploads
mkdir -p /tmp/drumtracker_conversions

echo "==> Post-merge setup complete."

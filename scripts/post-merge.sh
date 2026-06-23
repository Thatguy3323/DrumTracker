#!/bin/bash
set -e

echo "==> Installing Python dependencies..."
uv sync

echo "==> Installing frontend dependencies..."
cd frontend && npm install --legacy-peer-deps
cd ..

echo "==> Ensuring upload/conversion directories exist..."
mkdir -p backend/uploads
mkdir -p /tmp/drumtracker_conversions

echo "==> Post-merge setup complete."

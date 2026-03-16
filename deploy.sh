#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
    cp .env.example .env
    echo "Created .env from .env.example"
    echo "Edit .env first, then re-run ./deploy.sh"
    exit 0
fi

docker compose pull || true
docker compose up -d --build
docker compose ps

echo
echo "Deployment complete."
echo "If DOMAIN is configured correctly, Caddy will provision HTTPS automatically."

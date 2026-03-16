#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/opt/wizard-of-wor}"
SERVICE_NAME="wizard-of-wor-compose.service"

if [[ ! -f "$APP_DIR/docker-compose.yml" ]]; then
  echo "Missing $APP_DIR/docker-compose.yml"
  exit 1
fi

install -m 0644 "$APP_DIR/infra/systemd/$SERVICE_NAME" "/etc/systemd/system/$SERVICE_NAME"
systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"

echo "Installed and started $SERVICE_NAME"
systemctl --no-pager status "$SERVICE_NAME" || true

#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <user@host> [remote_dir]"
    exit 1
fi

REMOTE="$1"
REMOTE_DIR="${2:-/opt/wizard-of-wor}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Deploying Wizard of Wor stack to $REMOTE:$REMOTE_DIR"
ssh "$REMOTE" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete --exclude node_modules --exclude .git "$SCRIPT_DIR"/ "$REMOTE":"$REMOTE_DIR"/
ssh "$REMOTE" "cd '$REMOTE_DIR' && chmod +x deploy.sh scripts/install-systemd-service.sh && ./deploy.sh"

echo "Done. Run this remotely once if you want auto-start on reboot:"
echo "  sudo $REMOTE_DIR/scripts/install-systemd-service.sh $REMOTE_DIR"

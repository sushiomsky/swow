#!/bin/bash

# Remote deployment script
# Usage: ./deploy-remote.sh <user@host>

if [ -z "$1" ]; then
    echo "Usage: $0 <user@host>"
    exit 1
fi

REMOTE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📦 Deploying Wizard of Wor to $REMOTE..."

# Copy to remote
ssh "$REMOTE" "rm -rf ~/wizard-of-wor && mkdir -p ~/wizard-of-wor"
scp -r "$SCRIPT_DIR"/* "$REMOTE":~/wizard-of-wor/

# Execute deployment
ssh "$REMOTE" "cd ~/wizard-of-wor && chmod +x deploy.sh && ./deploy.sh"

echo "✅ Deployment complete!"
echo "🎮 Game available at https://144.76.188.142"

#!/bin/bash
set -e

# Generate self-signed certificates if they don't exist
CERT_DIR="certs"
if [ ! -d "$CERT_DIR" ]; then
    mkdir -p "$CERT_DIR"
    openssl req -x509 -newkey rsa:4096 -nodes -out "$CERT_DIR/cert.pem" -keyout "$CERT_DIR/key.pem" -days 365 \
        -subj "/C=US/ST=State/L=City/O=Org/CN=144.76.188.142"
    echo "✅ Self-signed certificates generated"
fi

# Stop and remove old container if it exists
docker stop wizard-of-wor-game 2>/dev/null || true
docker rm wizard-of-wor-game 2>/dev/null || true

# Build Docker image
docker build -t wizard-of-wor:latest .
echo "✅ Docker image built"

# Run container
docker run -d \
    --name wizard-of-wor-game \
    -p 443:443 \
    -v $(pwd)/certs:/app/certs:ro \
    wizard-of-wor:latest

sleep 2
echo "✅ Container running"
docker logs wizard-of-wor-game || true
echo "🎮 Game available at https://144.76.188.142"

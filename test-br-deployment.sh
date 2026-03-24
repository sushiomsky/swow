#!/bin/bash
# Battle Royale Deployment Test Script

echo "🧪 Testing Battle Royale Deployment"
echo "===================================="
echo

echo "1. Checking server process..."
ps aux | grep "[n]ode server-multiplayer" && echo "✅ Server running" || echo "❌ Server not running"
echo

echo "2. Checking port 5001..."
netstat -tlnp | grep :5001 && echo "✅ Port 5001 listening" || echo "❌ Port 5001 not listening"
echo

echo "3. Testing HTML deployment (landing page)..."
if curl -s https://wizardofwor.duckdns.org/play | grep -q "Connected dungeons"; then
    echo "✅ Landing page deployed with BR descriptions"
else
    echo "❌ Landing page missing BR content"
fi
echo

echo "4. Checking server logs..."
if tail -20 /tmp/mp-debug.log | grep -q "Battle Royale mode: ENABLED"; then
    echo "✅ BR mode enabled in logs"
else
    echo "❌ BR mode not confirmed in logs"
fi
echo

echo "5. Server initialization check..."
tail -10 /tmp/mp-debug.log | grep -E "Initialized|started"
echo

echo "===================================="
echo "Deployment test complete!"

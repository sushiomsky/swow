const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:5001/multiplayer');

ws.on('open', () => {
    console.log('[Test] Connected to server');
    // Join solo
    ws.send(JSON.stringify({ type: 'join_solo' }));
});

let initReceived = false;
ws.on('message', (data) => {
    const msg = JSON.parse(data);
    console.log('[Test] Received:', msg.type, msg.playerId || msg.dungeonId);
    if (msg.type === 'init') initReceived = true;
});

ws.on('error', (err) => {
    console.error('[Test] Error:', err.message);
});

ws.on('close', () => {
    console.log('[Test] Connection closed');
    process.exit(0);
});

setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
}, 3000);

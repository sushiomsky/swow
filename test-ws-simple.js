const http = require('http');
const WebSocket = require('ws');

const httpServer = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hello World');
});

const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.send('Welcome');
    
    ws.on('message', (msg) => {
        console.log('Received:', msg);
        ws.send('Echo: ' + msg);
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

httpServer.listen(5001, () => {
    console.log('Server on 5001');
});

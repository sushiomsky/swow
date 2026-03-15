'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { GameServer } = require('./src/server/GameServer');

const PORT = process.env.MP_PORT || 5001;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html',
    '.js':   'text/javascript',
    '.css':  'text/css',
    '.png':  'image/png',
    '.ico':  'image/x-icon',
    '.ogg':  'audio/ogg',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.json': 'application/json',
};

const httpServer = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/multiplayer.html';

    const filePath = path.join(ROOT, urlPath);
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
    });
});

const gameServer = new GameServer(httpServer);

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Wizard of Wor — Multiplayer server on http://0.0.0.0:${PORT}`);
    console.log(`   Open http://localhost:${PORT}/multiplayer.html`);
    console.log(`   Press Ctrl+C to stop`);
});

process.on('SIGINT', () => { gameServer.stop(); process.exit(0); });

process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err.message);
    console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

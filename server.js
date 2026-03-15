const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const HOST = '0.0.0.0';
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.ogg': 'audio/ogg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.json': 'application/json',
};

const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0]; // strip query params
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(ROOT, urlPath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.log(`404: ${urlPath}`);
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': mime,
            'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
    });
});

server.listen(PORT, HOST, () => {
    console.log(`🎮 Wizard of Wor running at http://${HOST}:${PORT}`);
    console.log(`   Press Ctrl+C to stop`);
});

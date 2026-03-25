'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');

const DOMAIN = process.env.DOMAIN || 'wizardofwor.duckdns.org';
const HTTP_PORT = Number(process.env.HTTP_PORT || 80);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 443);
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || '/etc/ssl/certs/ssl-cert-snakeoil.pem';
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || '/etc/ssl/private/ssl-cert-snakeoil.key';

const TARGETS = {
    single: {
        host: process.env.SINGLE_HOST || '127.0.0.1',
        port: Number(process.env.SINGLE_PORT || 3000),
    },
    multiplayer: {
        host: process.env.MULTIPLAYER_HOST || '127.0.0.1',
        port: Number(process.env.MULTIPLAYER_PORT || 5001),
    },
    communityApi: {
        host: process.env.COMMUNITY_API_HOST || '127.0.0.1',
        port: Number(process.env.COMMUNITY_API_PORT || 7000),
    },
    communityWeb: {
        host: process.env.COMMUNITY_WEB_HOST || '127.0.0.1',
        port: Number(process.env.COMMUNITY_WEB_PORT || 3001),
    },
};

function getForwardedForHeader(req) {
    const prior = req.headers['x-forwarded-for'];
    const remote = req.socket.remoteAddress;
    if (typeof prior === 'string' && prior.length > 0) {
        return `${prior}, ${remote}`;
    }
    return remote;
}

function getTarget(pathname) {
    if (
        pathname === '/multiplayer' ||
        pathname.startsWith('/multiplayer/') ||
        pathname === '/spectate' ||
        pathname.startsWith('/spectate/') ||
        pathname === '/minimap' ||
        pathname.startsWith('/minimap/')
    ) {
        return TARGETS.multiplayer;
    }

    if (pathname === '/socket.io' || pathname.startsWith('/socket.io/')) {
        return TARGETS.communityApi;
    }

    if (pathname === '/api/community' || pathname.startsWith('/api/community/')) {
        return TARGETS.communityApi;
    }

    if (
        pathname === '/community' ||
        pathname.startsWith('/community/') ||
        pathname === '/admin' ||
        pathname.startsWith('/admin/') ||
        pathname === '/_next' ||
        pathname.startsWith('/_next/')
    ) {
        return TARGETS.communityWeb;
    }

    return TARGETS.single;
}

function buildProxyHeaders(req, protocol) {
    return {
        ...req.headers,
        host: req.headers.host || DOMAIN,
        'x-forwarded-for': getForwardedForHeader(req),
        'x-forwarded-host': req.headers.host || DOMAIN,
        'x-forwarded-proto': protocol,
    };
}

function proxyHttpRequest(req, res, protocol) {
    const pathname = new URL(req.url, `${protocol}://${req.headers.host || DOMAIN}`).pathname;
    const target = getTarget(pathname);

    const upstream = http.request(
        {
            host: target.host,
            port: target.port,
            method: req.method,
            path: req.url,
            headers: buildProxyHeaders(req, protocol),
        },
        (upstreamRes) => {
            res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
            upstreamRes.pipe(res);
        }
    );

    upstream.on('error', (error) => {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Bad Gateway: ${error.message}`);
    });

    req.pipe(upstream);
}

function proxyUpgradeRequest(req, socket, head, protocol) {
    const pathname = new URL(req.url, `${protocol}://${req.headers.host || DOMAIN}`).pathname;
    const target = getTarget(pathname);
    const upstream = net.createConnection({ host: target.host, port: target.port }, () => {
        const headers = Object.entries(buildProxyHeaders(req, protocol))
            .map(([name, value]) => `${name}: ${value}`)
            .join('\r\n');

        upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`);
        if (head.length > 0) {
            upstream.write(head);
        }

        socket.pipe(upstream);
        upstream.pipe(socket);
    });

    upstream.on('error', () => {
        socket.destroy();
    });

    socket.on('error', () => {
        upstream.destroy();
    });
}

const httpServer = http.createServer((req, res) => proxyHttpRequest(req, res, 'http'));
httpServer.on('upgrade', (req, socket, head) => proxyUpgradeRequest(req, socket, head, 'http'));

const tlsOptions = {
    cert: fs.readFileSync(TLS_CERT_PATH),
    key: fs.readFileSync(TLS_KEY_PATH),
};

const httpsServer = https.createServer(tlsOptions, (req, res) => proxyHttpRequest(req, res, 'https'));
httpsServer.on('upgrade', (req, socket, head) => proxyUpgradeRequest(req, socket, head, 'https'));

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`Wizard of Wor edge HTTP proxy listening on http://0.0.0.0:${HTTP_PORT}`);
});

httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`Wizard of Wor edge HTTPS proxy listening on https://0.0.0.0:${HTTPS_PORT}`);
});

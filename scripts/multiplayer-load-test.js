#!/usr/bin/env node
'use strict';

const WebSocket = require('ws');

const URL = process.env.MP_LOAD_URL || 'ws://127.0.0.1:5001';
const PAIRS = Number(process.env.MP_LOAD_PAIRS || 20);
const DURATION_MS = Number(process.env.MP_LOAD_DURATION_MS || 10000);
const INPUT_INTERVAL_MS = Number(process.env.MP_LOAD_INPUT_INTERVAL_MS || 20);

let totalStateMessages = 0;
const sockets = [];
const inputTimers = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function wireStateCounter(ws) {
    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(String(raw));
            if (msg && msg.type === 'state') totalStateMessages += 1;
        } catch (_) {}
    });
}

function createSocket() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(URL);
        const onError = (err) => {
            ws.removeAllListeners('open');
            reject(err);
        };
        ws.once('error', onError);
        ws.once('open', () => {
            ws.removeListener('error', onError);
            resolve(ws);
        });
    });
}

async function createPrivatePair() {
    const host = await createSocket();
    sockets.push(host);
    wireStateCounter(host);

    let privateCode = null;
    host.on('message', (raw) => {
        try {
            const msg = JSON.parse(String(raw));
            if (msg && msg.type === 'private_pair_created' && msg.code) {
                privateCode = msg.code;
            }
        } catch (_) {}
    });
    host.send(JSON.stringify({ type: 'join_pair' }));

    const timeoutAt = Date.now() + 5000;
    while (!privateCode && Date.now() < timeoutAt) {
        await sleep(25);
    }
    if (!privateCode) {
        throw new Error('Timed out waiting for private pair code');
    }

    const guest = await createSocket();
    sockets.push(guest);
    wireStateCounter(guest);
    guest.send(JSON.stringify({ type: 'join_private_pair', code: privateCode }));

    for (const ws of [host, guest]) {
        const timer = setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN) return;
            ws.send(JSON.stringify({
                type: 'input',
                keys: {
                    up: false,
                    down: false,
                    left: false,
                    right: false,
                    fire: false
                }
            }));
        }, INPUT_INTERVAL_MS);
        inputTimers.push(timer);
    }
}

async function main() {
    if (!Number.isFinite(PAIRS) || PAIRS < 1) {
        throw new Error(`Invalid MP_LOAD_PAIRS value: ${process.env.MP_LOAD_PAIRS}`);
    }
    if (!Number.isFinite(DURATION_MS) || DURATION_MS < 1000) {
        throw new Error(`Invalid MP_LOAD_DURATION_MS value: ${process.env.MP_LOAD_DURATION_MS}`);
    }

    const startTime = Date.now();
    for (let i = 0; i < PAIRS; i += 1) {
        await createPrivatePair();
    }

    await sleep(DURATION_MS);

    for (const timer of inputTimers) clearInterval(timer);
    for (const ws of sockets) {
        try {
            ws.close();
        } catch (_) {}
    }

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const stateMessagesPerSecond = totalStateMessages / elapsedSeconds;

    console.log(`url=${URL}`);
    console.log(`pairs=${PAIRS}`);
    console.log(`clients=${PAIRS * 2}`);
    console.log(`duration_seconds=${elapsedSeconds.toFixed(2)}`);
    console.log(`state_messages_total=${totalStateMessages}`);
    console.log(`state_messages_per_second=${stateMessagesPerSecond.toFixed(2)}`);
}

main().catch((error) => {
    console.error('[multiplayer-load-test] failed:', error.message);
    process.exit(1);
});

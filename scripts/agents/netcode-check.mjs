#!/usr/bin/env node
/**
 * Netcode agent check — validates WebSocket endpoint reachability, active-games sync
 * latency, and basic connection health indicators.
 */
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { WebSocket } from 'ws';

const HTTP_BASE = process.env.NETCODE_CHECK_HTTP_BASE || 'http://127.0.0.1:42735';
const WS_URL = process.env.NETCODE_CHECK_WS_URL || 'ws://127.0.0.1:42735/multiplayer';
const LATENCY_THRESHOLD_MS = Number(process.env.NETCODE_LATENCY_THRESHOLD_MS || 500);
const HANDSHAKE_TIMEOUT_MS = 5000;

async function checkHttpEndpoints(checks, failures) {
  // active-games
  const t0 = Date.now();
  try {
    const res = await fetch(`${HTTP_BASE}/multiplayer/active-games`, { cache: 'no-store' });
    assert.equal(res.status, 200, `active-games: expected 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(typeof data.total_games, 'number', 'total_games not a number');
    assert.ok(Array.isArray(data.games), 'games is not array');
    const ms = Date.now() - t0;
    checks.push(`active-games-http:${ms}ms`);
    if (ms > LATENCY_THRESHOLD_MS) {
      failures.push(`active-games HTTP latency ${ms}ms exceeds threshold ${LATENCY_THRESHOLD_MS}ms`);
    }
  } catch (err) {
    failures.push(`active-games HTTP: ${err.message}`);
  }

  // dungeon-topology
  const t1 = Date.now();
  try {
    const res = await fetch(`${HTTP_BASE}/multiplayer/dungeon-topology`, { cache: 'no-store' });
    assert.equal(res.status, 200, `dungeon-topology: expected 200, got ${res.status}`);
    const data = await res.json();
    assert.ok(Array.isArray(data.dungeons), 'dungeons is not array');
    checks.push(`dungeon-topology-http:${(Date.now() - t1)}ms`);
  } catch (err) {
    failures.push(`dungeon-topology HTTP: ${err.message}`);
  }
}

function checkWebSocket(checks, failures) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        failures.push(`WebSocket handshake timed out after ${HANDSHAKE_TIMEOUT_MS}ms at ${WS_URL}`);
        resolve();
      }
    }, HANDSHAKE_TIMEOUT_MS);

    let ws;
    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      clearTimeout(timeout);
      failures.push(`WebSocket construction failed: ${err.message}`);
      resolve();
      return;
    }

    ws.on('open', () => {
      if (settled) return;
      const ms = Date.now() - t0;
      checks.push(`websocket-handshake:${ms}ms`);
      if (ms > LATENCY_THRESHOLD_MS) {
        failures.push(`WebSocket handshake ${ms}ms exceeds threshold ${LATENCY_THRESHOLD_MS}ms`);
      }
      ws.close();
    });

    ws.on('close', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    ws.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        failures.push(`WebSocket error: ${err.message}`);
        resolve();
      }
    });
  });
}

async function run() {
  const checks = [];
  const failures = [];

  await checkHttpEndpoints(checks, failures);
  await checkWebSocket(checks, failures);

  if (failures.length > 0) {
    console.error('Netcode checks failed:');
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`Netcode checks passed (${checks.length} checks):`);
  for (const c of checks) console.log(`  ✓ ${c}`);
}

run().catch((err) => {
  console.error(`Netcode check crashed: ${err.message}`);
  process.exit(1);
});

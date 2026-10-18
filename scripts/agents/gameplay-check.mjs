#!/usr/bin/env node
/**
 * Gameplay agent check — validates all 4 BR modes are joinable and live.
 * v2: no bots — instant modes get a full human join→init→state→input probe,
 * queue modes get a join→queue-status probe (launch needs >= MIN humans).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const BASE = process.env.GAMEPLAY_CHECK_BASE_URL || 'https://wizardofwor.duckdns.org';
const ACTIVE_GAMES_URL = `${BASE}/multiplayer/active-games`;
const WS_URL = process.env.GAMEPLAY_CHECK_WS_URL
  || (`${BASE.replace(/^http/, 'ws')}/multiplayer`);
const LATENCY_THRESHOLD_MS = Number(process.env.GAMEPLAY_CHECK_LATENCY_THRESHOLD_MS || 5000);
const PROBE_TIMEOUT_MS = Number(process.env.GAMEPLAY_PROBE_TIMEOUT_MS || 8000);

const INSTANT_MODES = [
  { key: 'endless', join: 'join_endless_br' },
  { key: 'team-endless', join: 'join_team_endless_br' },
];
const QUEUE_MODES = [
  { key: 'sitngo', join: 'join_sitngo_br', status: 'sitngo_queue_status' },
  { key: 'team-sitngo', join: 'join_team_sitngo_br', status: 'team_queue_status' },
];

function waitFor(ws, predicate, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener('message', onMessage);
      reject(new Error(`timeout waiting for ${label}`));
    }, timeoutMs);
    function onMessage(raw) {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.removeListener('message', onMessage);
        resolve(msg);
      }
    }
    ws.on('message', onMessage);
  });
}

async function probeInstant(mode, checks, failures) {
  const ws = new WebSocket(WS_URL);
  try {
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('connect timeout')), PROBE_TIMEOUT_MS);
    });
    await waitFor(ws, (m) => m.type === 'connected', PROBE_TIMEOUT_MS, 'connected');
    ws.send(JSON.stringify({ type: mode.join, playerName: `probe-${mode.key}` }));
    const init = await waitFor(ws, (m) => m.type === 'init', PROBE_TIMEOUT_MS, 'init');
    assert.ok(init.playerId, 'init missing playerId');
    checks.push(`mode-${mode.key}:join-init`);
    await waitFor(ws, (m) => m.type === 'state', PROBE_TIMEOUT_MS, 'state');
    await waitFor(ws, (m) => m.type === 'state', PROBE_TIMEOUT_MS, 'state2');
    checks.push(`mode-${mode.key}:state-flow`);
    ws.send(JSON.stringify({ type: 'input', keys: { right: true } }));
    const withSelf = await waitFor(
      ws,
      (m) => m.type === 'state' && Array.isArray(m.state?.players)
        && m.state.players.some((p) => p.id === init.playerId),
      PROBE_TIMEOUT_MS,
      'self-in-state',
    );
    assert.ok(withSelf, 'own player missing from state');
    checks.push(`mode-${mode.key}:self-in-state`);
  } catch (err) {
    failures.push(`mode-${mode.key}: ${err.message}`);
  } finally {
    try { ws.close(); } catch { /* ignore */ }
  }
}

async function probeQueue(mode, checks, failures) {
  const ws = new WebSocket(WS_URL);
  try {
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('connect timeout')), PROBE_TIMEOUT_MS);
    });
    await waitFor(ws, (m) => m.type === 'connected', PROBE_TIMEOUT_MS, 'connected');
    ws.send(JSON.stringify({ type: mode.join, playerName: `probe-${mode.key}` }));
    await waitFor(ws, (m) => m.type === mode.status, PROBE_TIMEOUT_MS, mode.status);
    checks.push(`mode-${mode.key}:queue-status`);
  } catch (err) {
    failures.push(`mode-${mode.key}: ${err.message}`);
  } finally {
    try { ws.close(); } catch { /* ignore */ }
  }
}

async function run() {
  const failures = [];
  const checks = [];

  // ── Latency + snapshot schema ──────────────────────────────────────
  const t0 = Date.now();
  let data;
  try {
    const res = await fetch(ACTIVE_GAMES_URL, { cache: 'no-store' });
    assert.equal(res.status, 200, `active-games: expected 200, got ${res.status}`);
    data = await res.json();
    checks.push('active-games-reachable');
  } catch (err) {
    failures.push(`active-games fetch failed: ${err.message}`);
    report(checks, failures);
    return;
  }
  const latencyMs = Date.now() - t0;
  if (latencyMs > LATENCY_THRESHOLD_MS) {
    failures.push(`active-games latency too high: ${latencyMs}ms (threshold: ${LATENCY_THRESHOLD_MS}ms)`);
  } else {
    checks.push(`active-games-latency:${latencyMs}ms`);
  }

  try {
    assert.equal(typeof data.total_games, 'number', 'missing total_games');
    assert.equal(typeof data.total_players, 'number', 'missing total_players');
    assert.ok(Array.isArray(data.games), 'games is not an array');
    checks.push('snapshot-schema');
  } catch (err) {
    failures.push(`snapshot schema: ${err.message}`);
  }

  // ── No bot-only population (v2: bots removed) ──────────────────────
  try {
    const botOnly = (data.games || []).filter((g) => (g.players || []).length > 0
      && (g.players || []).every((p) => p.isBot));
    assert.equal(botOnly.length, 0, `${botOnly.length} bot-only dungeons still seeded`);
    checks.push('no-bot-seeds');
  } catch (err) {
    failures.push(err.message);
  }

  // ── Entry shape (only when games exist) ────────────────────────────
  for (const game of (data.games || []).slice(0, 4)) {
    try {
      assert.ok(game.dungeon_id, 'game missing dungeon_id');
      assert.ok(game.mode, 'game missing mode');
      assert.equal(typeof game.player_count, 'number', 'game missing player_count');
      assert.ok(['in_progress', 'waiting_for_partner'].includes(game.status), `unexpected game status: ${game.status}`);
    } catch (err) {
      failures.push(`game entry validation: ${err.message}`);
    }
  }
  if (data.games && data.games.length > 0) checks.push('game-entries-valid');

  // ── Live join probes ───────────────────────────────────────────────
  for (const mode of INSTANT_MODES) {
    // eslint-disable-next-line no-await-in-loop
    await probeInstant(mode, checks, failures);
  }
  for (const mode of QUEUE_MODES) {
    // eslint-disable-next-line no-await-in-loop
    await probeQueue(mode, checks, failures);
  }

  report(checks, failures);
}

function report(checks, failures) {
  if (failures.length > 0) {
    console.error('Gameplay checks failed:');
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`Gameplay checks passed (${checks.length} checks):`);
  for (const c of checks) console.log(`  ✓ ${c}`);
}

run().catch((err) => {
  console.error(`Gameplay check crashed: ${err.message}`);
  process.exit(1);
});

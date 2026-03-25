#!/usr/bin/env node
/**
 * Gameplay agent check — validates that bot-seeded games are running across all 4 BR modes
 * and that the server is responding within acceptable latency.
 */
import assert from 'node:assert/strict';

const BASE = process.env.GAMEPLAY_CHECK_BASE_URL || 'https://wizardofwor.duckdns.org';
const ACTIVE_GAMES_URL = `${BASE}/multiplayer/active-games`;
const TARGET_DUNGEONS_PER_MODE = Number(process.env.TARGET_DUNGEONS_PER_MODE || 4);
const REQUIRED_MODES = ['endless', 'sitngo', 'team-endless', 'team-sitngo'];
const LATENCY_THRESHOLD_MS = Number(process.env.GAMEPLAY_LATENCY_THRESHOLD_MS || 5000);

async function run() {
  const failures = [];
  const checks = [];

  // ── Latency check ──────────────────────────────────────────────────────────
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

  // ── Snapshot schema ────────────────────────────────────────────────────────
  try {
    assert.equal(typeof data.total_games, 'number', 'missing total_games');
    assert.equal(typeof data.total_players, 'number', 'missing total_players');
    assert.ok(Array.isArray(data.games), 'games is not an array');
    checks.push('snapshot-schema');
  } catch (err) {
    failures.push(`snapshot schema: ${err.message}`);
  }

  // ── Mode coverage ──────────────────────────────────────────────────────────
  const byMode = {};
  for (const game of data.games || []) {
    byMode[game.mode] = (byMode[game.mode] || 0) + 1;
  }

  for (const mode of REQUIRED_MODES) {
    const count = byMode[mode] || 0;
    if (count < 1) {
      failures.push(`mode "${mode}": 0 dungeons (expected >= 1); bot seeding may not have run yet`);
    } else {
      checks.push(`mode-${mode}:${count}-dungeons`);
    }
  }

  // ── Bot seeding target ─────────────────────────────────────────────────────
  for (const mode of REQUIRED_MODES) {
    const count = byMode[mode] || 0;
    if (count > 0 && count < TARGET_DUNGEONS_PER_MODE) {
      // Warn but don't fail — games may still be filling up after restart
      console.warn(`[gameplay] WARN: mode "${mode}" has ${count}/${TARGET_DUNGEONS_PER_MODE} dungeons`);
    }
  }

  // ── Active game structure ──────────────────────────────────────────────────
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

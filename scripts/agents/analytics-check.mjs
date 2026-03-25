#!/usr/bin/env node
/**
 * Analytics agent check — generates a snapshot report of live game activity:
 * mode distribution, bot/human ratio, queue depth, and active player count.
 * Outputs structured data and flags anomalies.
 */

const BASE = process.env.ANALYTICS_CHECK_BASE_URL || 'https://wizardofwor.duckdns.org';
const API_BASE = process.env.ANALYTICS_API_BASE_URL || 'https://wizardofwor.duckdns.org';

async function run() {
  const failures = [];
  const report = {};

  // ── Active games snapshot ──────────────────────────────────────────────────
  let snapshot;
  try {
    const res = await fetch(`${BASE}/multiplayer/active-games`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    snapshot = await res.json();
  } catch (err) {
    failures.push(`active-games fetch failed: ${err.message}`);
    finalize(report, failures);
    return;
  }

  // ── Mode distribution ──────────────────────────────────────────────────────
  const byMode = {};
  let totalHumans = 0;
  let totalBots = 0;
  let joinableGames = 0;

  for (const game of snapshot.games || []) {
    byMode[game.mode] = (byMode[game.mode] || 0) + 1;
    const humans = (game.players || []).filter(p => !p.isBot).length;
    const bots = (game.players || []).filter(p => p.isBot).length;
    totalHumans += humans;
    totalBots += bots;
    if (game.joinable) joinableGames++;
  }

  report.timestamp = new Date().toISOString();
  report.total_games = snapshot.total_games;
  report.total_players = snapshot.total_players;
  report.human_players = totalHumans;
  report.bot_players = totalBots;
  report.bot_ratio_pct = snapshot.total_players > 0
    ? Math.round((totalBots / snapshot.total_players) * 100)
    : 0;
  report.joinable_games = joinableGames;
  report.queued_sitngo_players = snapshot.queued_sitngo_players || 0;
  report.queued_team_sitngo_players = snapshot.queued_team_sitngo_players || 0;
  report.mode_distribution = byMode;

  // ── Anomaly detection ─────────────────────────────────────────────────────
  const EXPECTED_MODES = ['endless', 'sitngo', 'team-endless', 'team-sitngo'];
  for (const mode of EXPECTED_MODES) {
    if (!byMode[mode]) {
      failures.push(`ANOMALY: mode "${mode}" has no active dungeons — bot seeding may have stalled`);
    }
  }

  if (report.total_games === 0) {
    failures.push('ANOMALY: zero active games — multiplayer server may be down');
  }

  // ── Community API health ───────────────────────────────────────────────────
  // API_BASE should point directly at the community-api container/port
  // where /health is served (not the web proxy which serves /api/community/*)
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
    report.community_api_status = res.ok ? 'healthy' : `unhealthy (${res.status})`;
    if (!res.ok) failures.push(`community-api health: HTTP ${res.status}`);
  } catch (err) {
    report.community_api_status = `unreachable: ${err.message}`;
    failures.push(`community-api health: ${err.message}`);
  }

  finalize(report, failures);
}

function finalize(report, failures) {
  console.log('\n═══════════════════════════════════════');
  console.log('  WizardOfWor Analytics Report');
  console.log(`  ${report.timestamp || new Date().toISOString()}`);
  console.log('═══════════════════════════════════════');
  console.log(`  Active games:      ${report.total_games ?? 'N/A'}`);
  console.log(`  Total players:     ${report.total_players ?? 'N/A'}`);
  console.log(`  Humans:            ${report.human_players ?? 'N/A'}`);
  console.log(`  Bots:              ${report.bot_players ?? 'N/A'} (${report.bot_ratio_pct ?? '?'}% of players)`);
  console.log(`  Joinable games:    ${report.joinable_games ?? 'N/A'}`);
  console.log(`  SitNGo queue:      ${report.queued_sitngo_players ?? 0} waiting`);
  console.log(`  Team SitNGo queue: ${report.queued_team_sitngo_players ?? 0} waiting`);
  console.log(`  Community API:     ${report.community_api_status ?? 'not checked'}`);
  if (report.mode_distribution) {
    console.log('\n  Mode distribution:');
    for (const [mode, count] of Object.entries(report.mode_distribution)) {
      console.log(`    ${mode.padEnd(16)} ${count} dungeon${count !== 1 ? 's' : ''}`);
    }
  }

  if (failures.length > 0) {
    console.log('\n  ⚠️  Anomalies detected:');
    for (const f of failures) console.log(`    ✗ ${f}`);
    console.log('═══════════════════════════════════════\n');
    process.exit(1);
  }

  console.log('\n  ✓ No anomalies detected');
  console.log('═══════════════════════════════════════\n');
}

run().catch((err) => {
  console.error(`Analytics check crashed: ${err.message}`);
  process.exit(1);
});

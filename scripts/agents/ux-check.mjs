#!/usr/bin/env node
import assert from 'node:assert/strict';

const BASE = process.env.UX_CHECK_BASE_URL || 'http://127.0.0.1:13000';
const ACTIVE_GAMES_BASE = process.env.UX_ACTIVE_GAMES_BASE_URL || BASE;

const ROUTES = [
  '/',
  '/community',
  '/community/chat',
  '/community/forum',
  '/community/leaderboards',
  '/community/features',
  '/community/contact'
];

async function fetchHtml(pathname) {
  const response = await fetch(`${BASE}${pathname}`);
  const body = await response.text();
  return { status: response.status, body };
}

function assertIncludes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message);
}

async function run() {
  const failures = [];

  for (const route of ROUTES) {
    const { status, body } = await fetchHtml(route);
    if (status !== 200) {
      failures.push(`${route}: expected 200, got ${status}`);
      continue;
    }
    try {
      assertIncludes(body, '<header class="site-header">', `${route}: missing site header`);
      assertIncludes(body, '<footer class="site-footer">', `${route}: missing site footer`);
      assertIncludes(body, '<main', `${route}: missing main landmark`);
      assertIncludes(body, '<title>', `${route}: missing title tag`);
    } catch (error) {
      failures.push(String(error.message || error));
    }
  }

  {
    const { status, body } = await fetchHtml('/');
    if (status !== 200) {
      failures.push(`/ : expected 200, got ${status}`);
    } else {
      try {
        assertIncludes(body, 'Multiplayer Modes', '/: missing "Multiplayer Modes" section');
        assertIncludes(body, 'Live Games', '/: missing live games panel');
      } catch (error) {
        failures.push(String(error.message || error));
      }
    }
  }

  {
    const response = await fetch(`${ACTIVE_GAMES_BASE}/multiplayer/active-games`);
    const text = await response.text();
    if (response.status !== 200) {
      failures.push(`/multiplayer/active-games: expected 200, got ${response.status}`);
    } else {
      try {
        const parsed = JSON.parse(text);
        assert.equal(typeof parsed.total_games, 'number', 'active-games: missing total_games');
        assert.ok(Array.isArray(parsed.games), 'active-games: games is not an array');
      } catch (error) {
        failures.push(`active-games JSON validation failed: ${error.message}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('UX checks failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`UX checks passed for ${ROUTES.length + 2} probes against ${BASE} (active-games base: ${ACTIVE_GAMES_BASE})`);
}

run().catch((error) => {
  console.error(`UX check crashed: ${error.message}`);
  process.exit(1);
});

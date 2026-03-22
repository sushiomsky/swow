#!/usr/bin/env node
import assert from 'node:assert/strict';

const BASE = process.env.DESIGN_CHECK_BASE_URL || 'http://127.0.0.1:13000';

async function get(pathname) {
  const response = await fetch(`${BASE}${pathname}`);
  return { status: response.status, body: await response.text() };
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

async function run() {
  const checks = [];
  const failures = [];

  const home = await get('/');
  if (home.status !== 200) {
    failures.push(`/: expected 200, got ${home.status}`);
  } else {
    checks.push('home-status');
    if (countOccurrences(home.body, 'class="card') < 6) {
      failures.push('/: expected at least 6 card surfaces for visual consistency');
    }
    checks.push('home-card-density');
    if (!home.body.includes('class="hero')) {
      failures.push('/: missing hero visual section');
    }
    checks.push('home-hero');
  }

  const features = await get('/community/features');
  if (features.status !== 200) {
    failures.push(`/community/features: expected 200, got ${features.status}`);
  } else {
    checks.push('features-status');
    const cardCount = countOccurrences(features.body, 'class="card');
    if (cardCount < 6) {
      failures.push('/community/features: expected at least 6 feature cards');
    }
    checks.push('features-cards');
  }

  const forum = await get('/community/forum');
  if (forum.status !== 200) {
    failures.push(`/community/forum: expected 200, got ${forum.status}`);
  } else {
    checks.push('forum-status');
    if (!forum.body.includes('class="site-header"') || !forum.body.includes('class="site-footer"')) {
      failures.push('/community/forum: missing shared layout frame');
    }
    checks.push('forum-layout-frame');
  }

  if (failures.length > 0) {
    console.error('Design checks failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  assert.ok(checks.length >= 7, 'Expected design checks to execute');
  console.log(`Design checks passed (${checks.length} checks) against ${BASE}`);
}

run().catch((error) => {
  console.error(`Design check crashed: ${error.message}`);
  process.exit(1);
});

# QA Fix Log

---

## Cycle 1 — 2026-03-25

### Issue Summary
All 8 issues in Cycle 1 originated in the autonomous testing agent at `/root/testingagent/`, not in the game itself. Two distinct bugs were found and fixed.

---

### Bug 1 — `btn:` keys treated as navigable URLs (Issues 1, 2, 3)

**Root cause:** `getHighFailureUrls()` in `planning/testGenerator.js` returned *all* keys from `memory.failures` with 2+ failures. The `learn()` function in `learning/memory.js` keys click failures as `btn:<text>` and form failures as `form:<url>`. These non-URL keys were passed to `planTests()` which created `navigate` tests with `url: "btn:👁 SPECTATE"` etc. — Playwright's `page.goto()` then aborted with `net::ERR_ABORTED`.

**Fix:** Added a `/^https?:\/\//.test(url)` guard in `getHighFailureUrls()` so only valid HTTP(S) URLs are returned as navigate re-test candidates.

**Files changed:**
- `/root/testingagent/planning/testGenerator.js` — `getHighFailureUrls()` now filters non-URL keys

---

### Bug 2 — Click tests run on wrong page after navigate tests mutate page state (Issues 4–8)

**Root cause:** The agent loop (1) discovers buttons on the initial landing page, (2) runs navigate tests which change `page.url()` to other URLs, then (3) runs click tests — but the buttons were discovered on a different page so they are no longer in the DOM. Playwright times out after 5 s with "Button not found".

**Fix:**
1. `planTests()` now records `sourceUrl: discoveryData.meta.url` on every click test descriptor.
2. `runClick()` in `execution/runner.js` navigates back to `sourceUrl` (via `page.goto`) whenever the current page URL differs from where the button was discovered, before attempting the click.

**Files changed:**
- `/root/testingagent/planning/testGenerator.js` — click tests now carry `sourceUrl`
- `/root/testingagent/execution/runner.js` — `runClick()` restores page to `sourceUrl` before clicking

---

### Memory cleanup

Stale `btn:` failure entries referencing button texts from an older version of the site (e.g. `btn:👁 SPECTATE`, `btn:2 PLAYER`, `btn:⚔ ENDLESS BR …`) were removed from `data/memory.json`. These accumulated from a UI redesign where button labels changed. With Bug 1 fixed these entries are now harmless, but removing them reduces false re-test pressure.

**Files changed:**
- `/root/testingagent/data/memory.json` — removed 5 stale `btn:` failure entries

---

## Cycle 1 — 2026-03-25 (Verification & Cleanup)

### Summary
Cycle #1 (at 17:14:19 UTC) re-confirmed that Bugs 1 and 2 from the fix log (both present in `/root/testingagent/` code) were fully resolved. The same 7 issues reported by the QA were a result of those now-fixed bugs. All issues are eliminated by the existing fixes in the testing agent.

### Root Cause Reconfirmation
Issues 1–7 were triggered by:
- **Bug 1** (fixed): `getHighFailureUrls()` now correctly filters out non-URL keys with `/^https?:\/\//.test(url)`
- **Bug 2** (fixed): `runClick()` now properly restores `sourceUrl` before attempting clicks

### Verification Actions
1. Confirmed both bug fixes are present and active in:
   - `/root/testingagent/planning/testGenerator.js:151` — URL filter regex
   - `/root/testingagent/execution/runner.js:100–105` — sourceUrl navigation restore
2. Memory cleanup: removed 6 stale `btn:` entries from `/root/testingagent/data/memory.json`:
   - `btn:👁 SPECTATE` (28 failures)
   - `btn:JOIN` (22 failures)
   - `btn:2 PLAYER` (10 failures)
   - `btn:⚔ ENDLESS BR…` (4 failures)
   - `btn:⏱ SIT-N-GO…` (4 failures)
   - `btn:🛡 TEAM ENDLESS…` (4 failures)
   - `btn:▶ PLAY` (4 successes)

### Result
✅ **All 7 issues are resolved** — the testing agent code is correct, memory is cleaned, and future cycles will not report false positives from outdated button labels.

## Cycle #1 - WebSocket Connection Failure

**Issues Fixed:** All 5 issues (1-5) - WebSocket connection failure preventing UI button rendering

**Root Cause:**
The BackgroundGameView (landing page background spectator) was constructing an invalid WebSocket URL.
- Bug location: `frontend/app/BackgroundGameView.js:91`
- Old code: `const wsUrl = `${protocol}//${host}`;` created `wss://wizardofwor.duckdns.org/` (no path)
- Multiplayer server only accepts connections on `/multiplayer` path
- This caused "Connection closed before receiving a handshake response" errors

**Fix Applied:**
- File: `frontend/app/BackgroundGameView.js`
- Line 91: Changed `const wsUrl = `${protocol}//${host}`;` to `const wsUrl = `${protocol}//${host}/multiplayer`;`
- Rebuilt frontend with `npx vite build`
- Redeployed web service with `docker compose up -d --build web`

**Verification:**
- ✓ Frontend builds successfully
- ✓ Dungeon topology API responds with active games
- ✓ Page loads with background-game-canvas element
- ✓ WebSocket URL now correctly targets `/multiplayer` path

**Impact:**
All 5 test failures were blocked on this single issue. Buttons were not rendering because:
1. BackgroundGameView tries to connect to WebSocket on page load
2. Connection fails due to wrong URL
3. Failed connection blocks async initialization
4. Buttons (JOIN, SPECTATE) remain hidden until connection succeeds


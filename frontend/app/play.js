/**
 * play.js — Arcade-first entry controller.
 *
 * Ultra-minimal: preloads game, shows retro title screen,
 * starts game instantly on click/keypress. No navigation, no menus.
 */

// ─── Module loaders (lazy, cached) ────────────────────────────────
let _spModule = null;
let _mpModule = null;

async function loadSP() {
    if (!_spModule) _spModule = await import('../game/singleplayer/App.js');
    return _spModule;
}
async function loadMP() {
    if (!_mpModule) _mpModule = await import('../game/multiplayer/client/MultiplayerApp.js');
    return _mpModule;
}

// ─── State ────────────────────────────────────────────────────────
let _state = 'title';    // title | playing | gameover
let _activeMode = null;   // 'sp' | 'mp' | null
let _pendingTimers = [];
let _cssLinks = [];
let _handlers = {};

const overlay = document.getElementById('play-overlay');
const gameRoot = document.getElementById('game-root');

// ─── Overlay ──────────────────────────────────────────────────────
function showOverlay(show) {
    overlay.classList.toggle('hide', !show);
}

// ─── DOM templates ────────────────────────────────────────────────
function createSPDOM() {
    const root = document.createElement('div');
    root.id = 'sp-root';
    root.innerHTML = `
        <div id="body">
            <div id="border">
                <canvas id="screen" width="960" height="600" class="hide" moz-opaque></canvas>
                <canvas id="visualFilterLayer" width="960" height="600"></canvas>
            </div>
            <div id="menuOverlay" class="hide"></div>
            <div id="menuToggler" class="hide"><span>Menu</span></div>
            <div id="menu">
                <div class="l1 back nosubmenu">&lt; Close</div>
                <div id="toggleFullscreen" class="l1 nosubmenu">Fullscreen</div>
                <div class="l1">Visual filter<div id="visualFilterSelect" class="items closed">
                    <div data-value="none">none</div>
                    <div data-value="scanlines">Scan lines</div>
                    <div data-value="bwTv">black and white TV</div>
                    <div data-value="colorTv">color TV</div>
                    <div data-value="greenC64monitor">green C64 monitor</div>
                </div></div>
                <div class="l1">Sounds<div id="soundSelect" class="items closed">
                    <div data-value="on">on</div>
                    <div data-value="off">off</div>
                </div></div>
                <div id="ctrlYellow" class="l1">Yellow warrior control<div id="yellowControlSelect" class="items closed">
                    <div data-value="keyboard">keyboard</div>
                    <div data-value="gamepad0">gamepad #1</div>
                    <div data-value="gamepad1">gamepad #2</div>
                    <div id="yellowBindUp">UP: -</div>
                    <div id="yellowBindDown">DOWN: -</div>
                    <div id="yellowBindLeft">LEFT: -</div>
                    <div id="yellowBindRight">RIGHT: -</div>
                    <div id="yellowBindFire">FIRE: -</div>
                </div></div>
                <div id="ctrlBlue" class="l1">Blue warrior control<div id="blueControlSelect" class="items closed">
                    <div data-value="keyboard">keyboard</div>
                    <div data-value="gamepad0">gamepad #1</div>
                    <div data-value="gamepad1">gamepad #2</div>
                    <div id="blueBindUp">UP: -</div>
                    <div id="blueBindDown">DOWN: -</div>
                    <div id="blueBindLeft">LEFT: -</div>
                    <div id="blueBindRight">RIGHT: -</div>
                    <div id="blueBindFire">FIRE: -</div>
                </div></div>
            </div>
        </div>
        <img src="/images/v4.0/noise.png" id="crtNoise" class="hide">
        <span style="font-family:WizardOfWor"></span>
    `;
    return root;
}

function createMPDOM() {
    const root = document.createElement('div');
    root.id = 'mp-root';
    root.innerHTML = `
        <div id="overlay">
            <h1>WIZARD OF WOR</h1>
            <p>2-Player Private Room</p>
            <div style="margin-top:20px;">
                <button class="btn blue" id="btnPairCreate">&#128279; CREATE ROOM</button>
                <div style="margin-top: 12px;">
                    <input id="pairCode" type="text" maxlength="12" placeholder="Room code"
                        style="padding: 10px 12px; font-family: inherit; width: 240px; text-transform: uppercase; letter-spacing: 2px;">
                    <button class="btn" id="btnPairJoin">JOIN ROOM</button>
                </div>
                <button class="btn dark" id="btnBackToMenu" style="margin-top:12px; background:#333;">&#9664; BACK</button>
            </div>
            <div id="status" role="status" aria-live="polite"></div>
        </div>
        <div id="body">
            <div id="border">
                <canvas id="screen" width="960" height="600" class="hide" moz-opaque></canvas>
                <canvas id="visualFilterLayer" width="960" height="600"></canvas>
            </div>
        </div>
        <img src="/images/v4.0/noise.png" id="crtNoise" class="hide">
        <span style="font-family:WizardOfWor"></span>
        <div id="hud" class="hide"><span id="hud-dungeon"></span></div>
        <div id="controls-hint">ARROWS + CTRL to move/shoot &nbsp;|&nbsp; ESC: back</div>
    `;
    return root;
}

// ─── CSS helper ───────────────────────────────────────────────────
function loadCSS(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    _cssLinks.push(link);
}

// ─── Teardown (clean up active mode) ──────────────────────────────
async function teardown() {
    _pendingTimers.forEach(id => clearInterval(id));
    _pendingTimers = [];

    for (const [event, handler] of Object.entries(_handlers)) {
        document.removeEventListener(event, handler);
    }
    _handlers = {};

    if (_activeMode === 'sp' && _spModule) {
        try { _spModule.destroySingleplayer(); } catch (_) { /* ok */ }
    } else if (_activeMode === 'mp' && _mpModule) {
        try { _mpModule.destroyMultiplayer(); } catch (_) { /* ok */ }
    }
    _activeMode = null;

    _cssLinks.forEach(l => l.remove());
    _cssLinks = [];

    gameRoot.innerHTML = '';
    document.getElementById('play-gameover')?.remove();
    document.querySelectorAll('.kill-popup').forEach(el => el.remove());
}

// ─── Build game-over overlay ──────────────────────────────────────
function buildGameOverOverlay(detail) {
    const { p1Score, p2Score, numPlayers, isNewHigh, wave } = detail;
    const topScore = Math.max(p1Score, p2Score);

    document.getElementById('play-gameover')?.remove();

    const el = document.createElement('div');
    el.id = 'play-gameover';

    const gameUrl = window.location.origin + '/play?challenge=' + topScore;
    const shareText = `I scored ${topScore} in Wizard of Wor (Wave ${wave}) — beat me! ${gameUrl}`;
    const twitterUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText);

    let html = '<div class="go-content">';
    if (isNewHigh) html += '<div class="go-newhigh">★ NEW HIGH SCORE ★</div>';
    html += `<div class="go-score">${topScore}</div>`;
    html += `<div class="go-wave">WAVE ${wave}</div>`;
    if (numPlayers > 1) html += `<div class="go-detail">P1: ${p1Score}  P2: ${p2Score}</div>`;
    html += '<div class="go-share">';
    html += `<a class="go-share-btn go-share-twitter" href="${twitterUrl}" target="_blank" rel="noopener">𝕏 SHARE</a>`;
    html += `<button class="go-share-btn go-share-copy" data-text="${shareText.replace(/"/g, '&quot;')}">📋 COPY</button>`;
    html += '</div>';
    html += '<div class="go-actions">';
    html += '<button class="go-replay-btn" id="go-replay">▶ PLAY AGAIN</button>';
    html += '</div>';
    html += '<div class="go-hint">PRESS FIRE TO RESTART</div>';
    html += '</div>';
    el.innerHTML = html;
    gameRoot.appendChild(el);

    el.querySelector('.go-share-copy')?.addEventListener('click', (ev) => {
        navigator.clipboard?.writeText(ev.currentTarget.dataset.text).then(() => {
            ev.currentTarget.textContent = '✓ COPIED';
        });
    });
    el.querySelector('#go-replay')?.addEventListener('click', () => startSP(1));
}

// ─── Start Singleplayer ───────────────────────────────────────────
async function startSP(numPlayers = 1) {
    await teardown();
    showOverlay(false);
    _activeMode = 'sp';

    loadCSS('/frontend/styles/singleplayer.css');
    gameRoot.appendChild(createSPDOM());

    // Screen shake on player death
    _handlers['swow:player-death'] = () => {
        gameRoot.classList.remove('shake');
        void gameRoot.offsetWidth;
        gameRoot.classList.add('shake');
    };

    // Game over → show score overlay
    _handlers['swow:game-over'] = (e) => {
        buildGameOverOverlay(e.detail);
        _state = 'gameover';
    };

    // Game restart (fire key in-engine) → remove overlay
    _handlers['swow:game-restart'] = () => {
        document.getElementById('play-gameover')?.remove();
        _state = 'playing';
    };

    // Kill score popups
    _handlers['swow:kill-score'] = (e) => {
        const { score, x, y } = e.detail;
        const canvas = gameRoot.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const sx = rect.left + (x / 320) * rect.width;
        const sy = rect.top + (y / 200) * rect.height;
        const pop = document.createElement('div');
        pop.className = 'kill-popup';
        pop.textContent = '+' + score;
        pop.style.left = sx + 'px';
        pop.style.top = sy + 'px';
        document.body.appendChild(pop);
        setTimeout(() => pop.remove(), 800);
    };

    for (const [event, handler] of Object.entries(_handlers)) {
        document.addEventListener(event, handler);
    }

    const mod = await loadSP();
    const app = mod.initSingleplayer();

    // Auto-start game (skip title screen)
    const timerId = setInterval(() => {
        if (app.engine) {
            clearInterval(timerId);
            _pendingTimers = _pendingTimers.filter(id => id !== timerId);
            app.engine.startNewGame(numPlayers);
        }
    }, 50);
    _pendingTimers.push(timerId);
    _state = 'playing';
}

// ─── Start Multiplayer ────────────────────────────────────────────
async function startMP(roomCode) {
    await teardown();
    showOverlay(false);
    _activeMode = 'mp';

    loadCSS('/frontend/styles/multiplayer.css');
    gameRoot.appendChild(createMPDOM());

    // Wire back button to return to title
    const backBtn = gameRoot.querySelector('#btnBackToMenu');
    if (backBtn) backBtn.addEventListener('click', () => goToTitle());

    if (roomCode) {
        const url = new URL(window.location);
        url.searchParams.set('room', roomCode);
        window.history.replaceState({}, '', url);
    }

    const mod = await loadMP();
    mod.initMultiplayer();

    if (roomCode) {
        window.history.replaceState({}, '', window.location.pathname);
    }

    _state = 'playing';
}

// ─── Return to title ──────────────────────────────────────────────
async function goToTitle() {
    await teardown();
    _state = 'title';
    showOverlay(true);
}

// ─── Bind UI ──────────────────────────────────────────────────────
document.getElementById('btn-play').addEventListener('click', () => startSP(1));
document.getElementById('btn-2p').addEventListener('click', () => startSP(2));
document.getElementById('btn-multi').addEventListener('click', () => startMP());

// Keyboard shortcuts (global)
document.addEventListener('keydown', (e) => {
    // Title screen shortcuts
    if (_state === 'title') {
        switch (e.code) {
            case 'Space': case 'Enter': case 'Digit1':
                e.preventDefault(); startSP(1); return;
            case 'Digit2':
                e.preventDefault(); startSP(2); return;
        }
        if (e.key === 'm' || e.key === 'M') {
            e.preventDefault(); startMP(); return;
        }
    }
    // ESC → back to title (from any game mode)
    if (e.code === 'Escape' && (_state === 'playing' || _state === 'gameover')) {
        e.preventDefault();
        goToTitle();
    }
});

// ─── Preload ──────────────────────────────────────────────────────
loadSP();
new Image().src = '/images/v3.0/sprite.png';

// ─── URL params: auto-join room / challenge banner ────────────────
const _params = new URLSearchParams(window.location.search);
const _roomCode = _params.get('room') || _params.get('pair');

if (_roomCode) {
    startMP(_roomCode);
} else {
    const challengeScore = parseInt(_params.get('challenge'));
    if (challengeScore && !isNaN(challengeScore)) {
        const banner = document.createElement('div');
        banner.className = 'play-challenge';
        banner.innerHTML = `🏆 Someone scored <strong>${challengeScore}</strong> — can you beat it?`;
        overlay.insertBefore(banner, overlay.firstChild);
        window.history.replaceState({}, '', window.location.pathname);
    }
    showOverlay(true);
}

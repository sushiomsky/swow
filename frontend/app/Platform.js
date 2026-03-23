/**
 * Platform.js — Central controller for the unified game platform.
 *
 * Manages mode transitions (menu / singleplayer / multiplayer) and
 * DOM lifecycle for each mode. Only one mode is active at a time.
 *
 * Usage:
 *   window.__SWOW_PLATFORM__ = true;   // suppress auto-init in mode modules
 *   const platform = new Platform();
 *   platform.init();                    // show main menu
 */

// Lazy-loaded mode modules — imported dynamically so we only load what's needed
let _spModule = null;
let _mpModule = null;

async function loadSingleplayer() {
    if (!_spModule) _spModule = await import('../game/singleplayer/App.js');
    return _spModule;
}

async function loadMultiplayer() {
    if (!_mpModule) _mpModule = await import('../game/multiplayer/client/MultiplayerApp.js');
    return _mpModule;
}

// ─── DOM templates ─────────────────────────────────────────────────────────
// Each mode needs specific DOM elements. We inject/remove them on transitions.

const SINGLEPLAYER_DOM_ID = 'sp-root';
const MULTIPLAYER_DOM_ID = 'mp-root';

function createSingleplayerDOM() {
    const root = document.createElement('div');
    root.id = SINGLEPLAYER_DOM_ID;
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
                <div class="l1 nosubmenu platform-back" style="background:#333;">&lt; BACK TO MENU</div>
                <div id="toggleFullscreen" class="l1 nosubmenu">Fullscreen</div>
                <div class="l1">Visual filter<div id="visualFilterSelect" class="items closed">
                        <div data-value="none">none</div>
                        <div data-value="scanlines">Scan lines</div>
                        <div data-value="bwTv">black and white TV</div>
                        <div data-value="colorTv">color TV</div>
                        <div data-value="greenC64monitor">green C64 monitor</div>
                    </div>
                </div>
                <div class="l1">Sounds<div id="soundSelect" class="items closed">
                        <div data-value="on">on</div>
                        <div data-value="off">off</div>
                    </div>
                </div>
                <div id="ctrlYellow" class="l1">Yellow warrior control<div id="yellowControlSelect" class="items closed">
                        <div data-value="keyboard">keyboard</div>
                        <div data-value="gamepad0">gamepad #1</div>
                        <div data-value="gamepad1">gamepad #2</div>
                        <div id="yellowBindUp">UP: -</div>
                        <div id="yellowBindDown">DOWN: -</div>
                        <div id="yellowBindLeft">LEFT: -</div>
                        <div id="yellowBindRight">RIGHT: -</div>
                        <div id="yellowBindFire">FIRE: -</div>
                    </div>
                </div>
                <div id="ctrlBlue" class="l1">Blue warrior control<div id="blueControlSelect" class="items closed">
                        <div data-value="keyboard">keyboard</div>
                        <div data-value="gamepad0">gamepad #1</div>
                        <div data-value="gamepad1">gamepad #2</div>
                        <div id="blueBindUp">UP: -</div>
                        <div id="blueBindDown">DOWN: -</div>
                        <div id="blueBindLeft">LEFT: -</div>
                        <div id="blueBindRight">RIGHT: -</div>
                        <div id="blueBindFire">FIRE: -</div>
                    </div>
                </div>
            </div>
        </div>
        <img src="/images/v4.0/noise.png" id="crtNoise" class="hide">
        <span style="font-family:WizardOfWor"></span>
    `;
    return root;
}

function createMultiplayerDOM() {
    const root = document.createElement('div');
    root.id = MULTIPLAYER_DOM_ID;
    root.innerHTML = `
        <div id="overlay">
            <h1>WIZARD OF WOR</h1>
            <p>Connected Dungeons &mdash; Multiplayer</p>
            <p class="subtext">Choose a mode: endless BR, sit-n-go BR, team BR, or private 2-player classic with a shareable link.</p>
            <div style="margin-top:20px;">
                <button class="btn" id="btnSolo">&#9654; ENDLESS BR (join anytime)</button>
                <button class="btn blue" id="btnSitNGo">&#9207; SIT-N-GO BR (queued start)</button>
                <button class="btn green" id="btnTeamBr">&#128737; TEAM BR (gold vs blue)</button>
                <button class="btn blue" id="btnPairCreate">&#128279; CREATE PRIVATE CLASSIC</button>
                <div style="margin-top: 12px;">
                    <input id="pairCode" type="text" maxlength="12" placeholder="Private code"
                        style="padding: 10px 12px; font-family: inherit; width: 240px; text-transform: uppercase; letter-spacing: 2px;">
                    <button class="btn" id="btnPairJoin">JOIN PRIVATE</button>
                </div>
                <button class="btn green hide" id="btnRetry">&#8635; RETRY LAST MODE</button>
                <button class="btn dark" id="btnBackToMenu" style="margin-top:12px; background:#333;">&#9664; BACK TO MENU</button>
            </div>
            <div id="status" role="status" aria-live="polite"></div>
            <p style="margin-top:30px; font-size:11px; color:#555;">
                <b>Endless BR:</b> join anytime, get your own dungeon and invade through tunnels.<br>
                <b>Sit-n-Go BR:</b> waits for enough players, then starts a closed ring of linked dungeons.<br>
                <b>Team BR:</b> players auto-balance between gold and blue teams.<br>
                <b>Private Classic:</b> host creates a private code/link and shares it with one friend.
            </p>
            <p style="margin-top:16px; font-size:11px;">
                <a href="/public/handbook.html" target="_blank" style="color:#6c5eb5; text-decoration:none;">&#128214; Game Handbook &amp; Reference</a>
            </p>
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
        <div id="controls-hint">ARROWS + CTRL to move/shoot &nbsp;|&nbsp; ESC: back to menu</div>
        <button id="settingsToggler" type="button">&#9881; Settings</button>
        <section id="settingsPanel" class="hide">
            <h2>Gameplay Settings</h2>
            <label>Controls
                <select id="settingControls">
                    <option value="keyboard">Keyboard</option>
                    <option value="gamepad0">Gamepad #1</option>
                    <option value="gamepad1">Gamepad #2</option>
                </select>
            </label>
            <div class="control-grid">
                <button type="button" id="settingControlUp">UP: -</button>
                <button type="button" id="settingControlDown">DOWN: -</button>
                <button type="button" id="settingControlLeft">LEFT: -</button>
                <button type="button" id="settingControlRight">RIGHT: -</button>
                <button type="button" id="settingControlFire">FIRE: -</button>
            </div>
            <label>Visual filter
                <select id="settingVisualFilter">
                    <option value="none">None</option>
                    <option value="scanlines">Scan lines</option>
                    <option value="bwTv">Black and white TV</option>
                    <option value="colorTv">Color TV</option>
                    <option value="greenC64monitor">Green C64 monitor</option>
                </select>
            </label>
            <label>Sound
                <select id="settingSound">
                    <option value="on">On</option>
                    <option value="off">Off</option>
                </select>
            </label>
            <p class="help">Settings apply immediately during gameplay and are saved for future sessions.</p>
        </section>
    `;
    return root;
}

// ─── Platform ──────────────────────────────────────────────────────────────

const MODES = { MENU: 'menu', SINGLEPLAYER: 'singleplayer', MULTIPLAYER: 'multiplayer' };

export class Platform {
    constructor() {
        this._mode = null;
        this._modeOptions = {};
        this._gameRoot = null;      // container element where mode DOM is injected
        this._menuEl = null;        // main menu overlay element
        this._cssLinks = [];        // dynamically loaded CSS <link> refs
        this._pendingTimers = [];   // intervals/timeouts to clear on teardown
        this._keyHandler = null;    // main menu keyboard shortcut listener
    }

    init() {
        this._gameRoot = document.getElementById('game-root');
        this._menuEl = document.getElementById('main-menu');
        this._bindMenuButtons();
        this._bindKeyboardShortcuts();
        this._showChallengeBanner();
        this._fetchLivePlayerCount();
        // Eagerly preload SP module + sprite while user reads menu
        this._preloadPromise = loadSingleplayer();
        const img = new Image();
        img.src = '/images/v3.0/sprite.png';
        this.switchMode(MODES.MENU);
    }

    _bindMenuButtons() {
        const el = (id) => document.getElementById(id);
        el('menu-sp-1p')?.addEventListener('click', () => this.switchMode(MODES.SINGLEPLAYER, { numPlayers: 1 }));
        el('menu-sp-2p')?.addEventListener('click', () => this.switchMode(MODES.SINGLEPLAYER, { numPlayers: 2 }));
        el('menu-mp')?.addEventListener('click', () => this.switchMode(MODES.MULTIPLAYER));
        el('menu-handbook')?.addEventListener('click', () => {
            window.open('/public/handbook.html', '_blank');
        });
    }

    _bindKeyboardShortcuts() {
        this._keyHandler = (e) => {
            if (this._mode !== MODES.MENU) return;
            switch (e.key) {
                case '1': case ' ': case 'Enter':
                    this.switchMode(MODES.SINGLEPLAYER, { numPlayers: 1 }); break;
                case '2': this.switchMode(MODES.SINGLEPLAYER, { numPlayers: 2 }); break;
                case 'm': case 'M': this.switchMode(MODES.MULTIPLAYER); break;
                case 'h': case 'H': window.open('/public/handbook.html', '_blank'); break;
                default: return;
            }
            e.preventDefault();
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    _showChallengeBanner() {
        const params = new URLSearchParams(window.location.search);
        const challengeScore = parseInt(params.get('challenge'));
        if (!challengeScore || isNaN(challengeScore)) return;
        const banner = document.createElement('div');
        banner.id = 'challenge-banner';
        banner.innerHTML = `<span>🏆 Someone scored <strong>${challengeScore}</strong> — can you beat it?</span>`;
        this._menuEl?.insertBefore(banner, this._menuEl.firstChild);
        // Clean URL without reload
        window.history.replaceState({}, '', window.location.pathname);
    }

    _fetchLivePlayerCount() {
        const badge = document.createElement('span');
        badge.id = 'live-players';
        badge.className = 'live-badge hide';
        const mpBtn = document.getElementById('menu-mp');
        if (mpBtn) mpBtn.parentElement.appendChild(badge);

        const update = () => {
            fetch('/multiplayer/active-games')
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (data && data.total_players > 0) {
                        badge.textContent = `${data.total_players} player${data.total_players > 1 ? 's' : ''} online`;
                        badge.classList.remove('hide');
                    } else {
                        badge.classList.add('hide');
                    }
                })
                .catch(() => badge.classList.add('hide'));
        };
        update();
        this._livePlayerInterval = setInterval(update, 15000);
    }

    async switchMode(mode, options = {}) {
        // Show loading overlay only if module isn't already cached
        if (mode === MODES.SINGLEPLAYER && _spModule) {
            // Already preloaded — skip spinner
        } else if (mode !== MODES.MENU) {
            this._showLoading(true);
        }

        // Tear down current mode
        await this._teardown();

        this._mode = mode;
        this._modeOptions = options;

        if (mode === MODES.MENU) {
            this._showMenu(true);
            return;
        }

        this._showMenu(false);

        if (mode === MODES.SINGLEPLAYER) {
            await this._startSingleplayer(options);
        } else if (mode === MODES.MULTIPLAYER) {
            await this._startMultiplayer();
        }

        this._showLoading(false);
    }

    async _teardown() {
        // Clear any pending timers (e.g. auto-start interval)
        this._pendingTimers.forEach(id => clearInterval(id));
        this._pendingTimers = [];

        // Remove death-shake listener
        if (this._deathShakeHandler) {
            document.removeEventListener('swow:player-death', this._deathShakeHandler);
            this._deathShakeHandler = null;
        }
        // Remove game-over/restart listeners
        if (this._gameOverHandler) {
            document.removeEventListener('swow:game-over', this._gameOverHandler);
            document.removeEventListener('swow:game-restart', this._gameRestartHandler);
            this._gameOverHandler = null;
            this._gameRestartHandler = null;
        }
        // Remove kill score listener
        if (this._killScoreHandler) {
            document.removeEventListener('swow:kill-score', this._killScoreHandler);
            this._killScoreHandler = null;
        }
        document.getElementById('gameover-overlay')?.remove();
        document.querySelectorAll('.kill-popup').forEach(el => el.remove());

        if (this._mode === MODES.SINGLEPLAYER) {
            const mod = await loadSingleplayer();
            mod.destroySingleplayer();
        } else if (this._mode === MODES.MULTIPLAYER) {
            const mod = await loadMultiplayer();
            mod.destroyMultiplayer();
        }

        // Remove floating back button
        document.getElementById('platform-back-float')?.remove();

        // Remove mode-specific DOM
        const existing = this._gameRoot?.firstChild;
        if (existing) existing.remove();

        // Remove mode-specific CSS
        this._cssLinks.forEach(link => link.remove());
        this._cssLinks = [];

        this._mode = null;
        this._modeOptions = {};
    }

    _showMenu(visible) {
        if (this._menuEl) this._menuEl.classList.toggle('hide', !visible);
    }

    _showLoading(visible) {
        let el = document.getElementById('platform-loading');
        if (visible && !el) {
            el = document.createElement('div');
            el.id = 'platform-loading';
            el.innerHTML = '<span class="spinner"></span> LOADING…';
            document.body.appendChild(el);
        } else if (!visible && el) {
            el.remove();
        }
    }

    _addFloatingBackButton() {
        const btn = document.createElement('button');
        btn.id = 'platform-back-float';
        btn.textContent = '◀ MENU';
        btn.addEventListener('click', () => this.goToMenu());
        document.body.appendChild(btn);
    }

    _loadCSS(href) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
        this._cssLinks.push(link);
    }

    async _startSingleplayer(options = {}) {
        this._loadCSS('/frontend/styles/singleplayer.css');
        this._gameRoot.appendChild(createSingleplayerDOM());

        // Wire platform-back button inside slide-out menu
        const backBtn = this._gameRoot.querySelector('.platform-back');
        if (backBtn) backBtn.addEventListener('click', () => this.goToMenu());

        // Add floating back-to-menu button
        this._addFloatingBackButton();

        // Screen shake on player death
        this._deathShakeHandler = () => {
            this._gameRoot.classList.remove('shake');
            void this._gameRoot.offsetWidth;
            this._gameRoot.classList.add('shake');
        };
        document.addEventListener('swow:player-death', this._deathShakeHandler);

        // Game over score overlay with share buttons and nudges
        this._gameOverHandler = (e) => {
            const { p1Score, p2Score, numPlayers, isNewHigh, wave } = e.detail;
            const existing = document.getElementById('gameover-overlay');
            if (existing) existing.remove();
            const topScore = Math.max(p1Score, p2Score);
            const el = document.createElement('div');
            el.id = 'gameover-overlay';

            const gameUrl = window.location.origin + '/?challenge=' + topScore;
            const shareText = `I scored ${topScore} in Wizard of Wor (Wave ${wave}) — beat me! ${gameUrl}`;
            const twitterUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText);

            let html = '<div class="gameover-content">';
            if (isNewHigh) html += '<div class="gameover-newhigh">★ NEW HIGH SCORE ★</div>';
            html += `<div class="gameover-score">${topScore}</div>`;
            html += `<div class="gameover-wave">WAVE ${wave}</div>`;
            if (numPlayers > 1) html += `<div class="gameover-detail">P1: ${p1Score}  P2: ${p2Score}</div>`;
            // Share buttons
            html += '<div class="gameover-share">';
            html += `<a class="share-btn share-twitter" href="${twitterUrl}" target="_blank" rel="noopener">𝕏 SHARE</a>`;
            html += `<button class="share-btn share-copy" data-text="${shareText.replace(/"/g, '&quot;')}">📋 COPY</button>`;
            html += '</div>';
            // Post-game nudge
            html += '<div class="gameover-nudge">';
            const bestScore = parseInt(localStorage.getItem('highScores')?.split(',')[0]) || 0;
            if (bestScore > topScore) {
                html += `<span class="nudge-text">YOUR BEST: ${bestScore} — TRY AGAIN!</span>`;
            }
            html += `<button class="nudge-btn nudge-mp">🌐 TRY MULTIPLAYER</button>`;
            html += '</div>';
            html += '<div class="gameover-hint">PRESS FIRE TO PLAY AGAIN</div>';
            html += '</div>';
            el.innerHTML = html;
            this._gameRoot.appendChild(el);

            // Wire share-copy button
            el.querySelector('.share-copy')?.addEventListener('click', (ev) => {
                const text = ev.currentTarget.dataset.text;
                navigator.clipboard?.writeText(text).then(() => {
                    ev.currentTarget.textContent = '✓ COPIED';
                });
            });
            // Wire multiplayer nudge
            el.querySelector('.nudge-mp')?.addEventListener('click', () => {
                this.switchMode(MODES.MULTIPLAYER);
            });
        };
        this._gameRestartHandler = () => {
            document.getElementById('gameover-overlay')?.remove();
        };
        document.addEventListener('swow:game-over', this._gameOverHandler);
        document.addEventListener('swow:game-restart', this._gameRestartHandler);

        // Kill score popups
        this._killScoreHandler = (e) => {
            const { score, x, y } = e.detail;
            const canvas = this._gameRoot.querySelector('canvas');
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            // Map game coords (320x200) to screen position
            const sx = rect.left + (x / 320) * rect.width;
            const sy = rect.top + (y / 200) * rect.height;
            const el = document.createElement('div');
            el.className = 'kill-popup';
            el.textContent = '+' + score;
            el.style.left = sx + 'px';
            el.style.top = sy + 'px';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 800);
        };
        document.addEventListener('swow:kill-score', this._killScoreHandler);

        const mod = await loadSingleplayer();
        const app = mod.initSingleplayer();

        // Auto-start game when engine is ready (skip title screen)
        const numPlayers = options.numPlayers || 1;
        const timerId = setInterval(() => {
            if (app.engine) {
                clearInterval(timerId);
                this._pendingTimers = this._pendingTimers.filter(id => id !== timerId);
                app.engine.startNewGame(numPlayers);
            }
        }, 50);
        this._pendingTimers.push(timerId);
    }

    async _startMultiplayer() {
        this._loadCSS('/frontend/styles/multiplayer.css');
        this._gameRoot.appendChild(createMultiplayerDOM());

        // Wire platform-back button
        const backBtn = this._gameRoot.querySelector('#btnBackToMenu');
        if (backBtn) backBtn.addEventListener('click', () => this.goToMenu());

        const mod = await loadMultiplayer();
        mod.initMultiplayer();
    }

    getMode() { return this._mode; }

    goToMenu() { this.switchMode(MODES.MENU); }
}

export { MODES };

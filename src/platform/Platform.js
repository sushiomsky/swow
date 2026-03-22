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
    if (!_spModule) _spModule = await import('../App.js');
    return _spModule;
}

async function loadMultiplayer() {
    if (!_mpModule) _mpModule = await import('../client/MultiplayerApp.js');
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
        this._gameRoot = null;      // container element where mode DOM is injected
        this._menuEl = null;        // main menu overlay element
        this._cssLinks = [];        // dynamically loaded CSS <link> refs
    }

    init() {
        this._gameRoot = document.getElementById('game-root');
        this._menuEl = document.getElementById('main-menu');
        this._bindMenuButtons();
        this.switchMode(MODES.MENU);
    }

    _bindMenuButtons() {
        const el = (id) => document.getElementById(id);
        el('menu-sp-1p')?.addEventListener('click', () => this.switchMode(MODES.SINGLEPLAYER));
        el('menu-sp-2p')?.addEventListener('click', () => this.switchMode(MODES.SINGLEPLAYER));
        el('menu-mp')?.addEventListener('click', () => this.switchMode(MODES.MULTIPLAYER));
        el('menu-handbook')?.addEventListener('click', () => {
            window.open('/public/handbook.html', '_blank');
        });
    }

    async switchMode(mode) {
        // Tear down current mode
        await this._teardown();

        this._mode = mode;

        if (mode === MODES.MENU) {
            this._showMenu(true);
            return;
        }

        this._showMenu(false);

        if (mode === MODES.SINGLEPLAYER) {
            await this._startSingleplayer();
        } else if (mode === MODES.MULTIPLAYER) {
            await this._startMultiplayer();
        }
    }

    async _teardown() {
        if (this._mode === MODES.SINGLEPLAYER) {
            const mod = await loadSingleplayer();
            mod.destroySingleplayer();
        } else if (this._mode === MODES.MULTIPLAYER) {
            const mod = await loadMultiplayer();
            mod.destroyMultiplayer();
        }

        // Remove mode-specific DOM
        const existing = this._gameRoot?.firstChild;
        if (existing) existing.remove();

        // Remove mode-specific CSS
        this._cssLinks.forEach(link => link.remove());
        this._cssLinks = [];

        this._mode = null;
    }

    _showMenu(visible) {
        if (this._menuEl) this._menuEl.classList.toggle('hide', !visible);
    }

    _loadCSS(href) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
        this._cssLinks.push(link);
    }

    async _startSingleplayer() {
        this._loadCSS('/src/styles/singleplayer.css');
        this._gameRoot.appendChild(createSingleplayerDOM());

        const mod = await loadSingleplayer();
        mod.initSingleplayer();
    }

    async _startMultiplayer() {
        this._loadCSS('/src/styles/multiplayer.css');
        this._gameRoot.appendChild(createMultiplayerDOM());

        const mod = await loadMultiplayer();
        mod.initMultiplayer();
    }

    getMode() { return this._mode; }

    goToMenu() { this.switchMode(MODES.MENU); }
}

export { MODES };

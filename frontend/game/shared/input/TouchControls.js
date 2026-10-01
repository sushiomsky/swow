/**
 * TouchControls.js — virtual D-Pad + fire button for coarse-pointer devices.
 *
 * One fixed-position overlay, created on demand and removed on teardown.
 * Writes action-level state into SharedControlsRuntime (setTouchHold),
 * so touch works with any keyboard/gamepad binding — no remapping needed.
 *
 * Behavior:
 * - Only shown when (pointer: coarse) OR touch points exist, AND the caller
 *   mounts it (SP/MP call mountTouchControls while playing).
 * - Multi-touch: pointer events with setPointerCapture per button, so
 *   D-Pad direction + fire can be held simultaneously.
 * - Sliding across the D-Pad moves the held direction (pointerover/out
 *   while a pointer is down), diagonals = two directions held.
 * - touch-action: none on all buttons — no scroll/zoom while playing.
 * - Removing the overlay (unmount) clears all touch holds (no stuck input).
 *
 * Layout (thumb-friendly, landscape-first):
 *   [D-Pad left]                      [FEUER right]
 * Portrait keeps the same split; buttons stay above the canvas (z-index)
 * and use safe-area-insets so notches/home-bars don't cover them.
 */

const OVERLAY_ID = 'swow-touch-controls';
const STORAGE_KEY = 'swowTouchControls';
const BODY_CLASS = 'swow-touch-visible';

const ACTIONS = ['up', 'down', 'left', 'right', 'fire'];
const LABELS = { up: '▲', down: '▼', left: '◀', right: '▶', fire: '●' };
const ARIA = {
    up: 'Hoch',
    down: 'Runter',
    left: 'Links',
    right: 'Rechts',
    fire: 'Feuer',
};

function hasTouchCapability() {
    try {
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
        if ('ontouchstart' in window) return true;
        if (navigator.maxTouchPoints > 0) return true;
    } catch (_) { /* conservative: no touch */ }
    return false;
}

// Primär-Touch (Handy/Tablet): grober Zeiger als HAUPT-Eingabe, also kein
// präziser Mauszeiger daneben. Hybrid-Laptops (coarse + fine) fallen raus —
// dort wäre das Overlay falsch, weil Tastatur/Maus vorhanden sind.
function isPrimaryTouchDevice() {
    try {
        const mq = window.matchMedia;
        if (mq) {
            const coarse = mq('(pointer: coarse)').matches;
            const fine = mq('(pointer: fine)').matches;
            if (coarse && !fine) return true;
            // Ältere Browser ohne fine-Abfrage: auf kleine Screens + Touch
            // eingrenzen (Handy-Portrait/Landscape), kein Desktop-Fenster.
            if (coarse && !mq('(pointer: fine)').media.includes('fine')) {
                return hasTouchCapability() && Math.min(screen.width, screen.height) <= 1024;
            }
            return false;
        }
    } catch (_) { /* fall through */ }
    return hasTouchCapability() && Math.min(screen.width || 9999, screen.height || 9999) <= 1024;
}

export function shouldShowTouchControls() {
    // Opt-in-Logik: automatisch NUR auf primären Touch-Geräten (mobil).
    // Überall sonst (Desktop, Hybrid-Laptop) nur wenn der User es in den
    // Einstellungen explizit eingeschaltet hat (swowTouchControls = 'on').
    if (isPrimaryTouchDevice()) return readEnabled() !== false;
    try {
        return localStorage.getItem(STORAGE_KEY) === 'on';
    } catch (_) {
        return false;
    }
}

export function isTouchDeviceAvailable() {
    return hasTouchCapability();
}

function readEnabled() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return true; // default ON for touch devices
        return raw !== 'off';
    } catch (_) {
        return true;
    }
}

export function setTouchControlsEnabled(enabled) {
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    } catch (_) { /* noop */ }
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.classList.toggle('hide', !enabled);
    document.body.classList.toggle(BODY_CLASS, !!enabled && !!el);
}

export function isTouchControlsEnabled() {
    return readEnabled();
}

function hold(runtime, action, held) {
    try {
        runtime?.setTouchHold?.(action, held);
    } catch (_) { /* never break gameplay */ }
}

function wireButton(btn, runtime, action) {
    // pointerdown starts the hold; pointerup/cancel/leave ends it.
    // Pointer capture keeps the hold alive if the thumb slides off.
    const down = (e) => {
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
        btn.classList.add('active');
        hold(runtime, action, true);
    };
    const up = (e) => {
        e.preventDefault();
        btn.classList.remove('active');
        hold(runtime, action, false);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', () => {
        btn.classList.remove('active');
        hold(runtime, action, false);
    });
    // Sliding across the D-Pad: while a pointer is held down elsewhere,
    // entering this button starts holding it; leaving releases it.
    btn.addEventListener('pointerover', (e) => {
        if (e.buttons > 0 && e.pointerType !== 'mouse') {
            btn.classList.add('active');
            hold(runtime, action, true);
        }
    });
    btn.addEventListener('pointerout', (e) => {
        if (e.buttons > 0 && e.pointerType !== 'mouse') {
            btn.classList.remove('active');
            hold(runtime, action, false);
        }
    });
    // No context menu on long-press.
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

function buildOverlay(runtime) {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    if (!readEnabled()) overlay.classList.add('hide');

    const pad = document.createElement('div');
    pad.className = 'swow-touch-pad';
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', 'Steuerkreuz');

    for (const action of ['up', 'left', 'right', 'down']) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `swow-touch-btn swow-touch-${action}`;
        btn.dataset.action = action;
        btn.textContent = LABELS[action];
        btn.setAttribute('aria-label', ARIA[action]);
        btn.tabIndex = -1;
        wireButton(btn, runtime, action);
        pad.appendChild(btn);
    }

    const fire = document.createElement('button');
    fire.type = 'button';
    fire.className = 'swow-touch-btn swow-touch-fire';
    fire.dataset.action = 'fire';
    fire.innerHTML = '<span aria-hidden="true">●</span><span class="swow-touch-fire-label">FEUER</span>';
    fire.setAttribute('aria-label', 'Feuer');
    fire.tabIndex = -1;
    wireButton(fire, runtime, 'fire');

    overlay.appendChild(pad);
    overlay.appendChild(fire);
    return overlay;
}

/**
 * Mount the touch overlay.
 * - Auf primären Touch-Geräten (mobil): automatisch (außer explizit aus).
 * - Überall sonst: nur nach explizitem Opt-in — mountTouchControls(runtime,
 *   { force: true }) aus dem Settings-Toggle. Reine Auto-Mounts ohne force
 *   bleiben dort No-op.
 * Returns the overlay element or null.
 */
export function mountTouchControls(runtime, options = {}) {
    if (!runtime) return null;
    if (document.getElementById(OVERLAY_ID)) return document.getElementById(OVERLAY_ID);
    const forced = options && options.force === true;
    if (!forced && !shouldShowTouchControls()) return null;
    const overlay = buildOverlay(runtime);
    document.body.appendChild(overlay);
    if (readEnabled() || forced) document.body.classList.add(BODY_CLASS);
    return overlay;
}

/** Remove the overlay and clear all holds (no stuck D-Pad after exit). */
export function unmountTouchControls(runtime) {
    try {
        runtime?.clearTouchHolds?.();
    } catch (_) { /* noop */ }
    document.getElementById(OVERLAY_ID)?.remove();
    document.body.classList.remove(BODY_CLASS);
}

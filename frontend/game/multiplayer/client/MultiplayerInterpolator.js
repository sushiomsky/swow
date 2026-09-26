/**
 * MultiplayerInterpolator — client-side snapshot interpolation (WIRE-2).
 *
 * The server simulates at 50 Hz but broadcasts wire snapshots at 20 Hz.
 * Rendering the newest snapshot directly would step motion at 20 Hz and
 * add up to one broadcast interval of visible latency. Instead this
 * buffer keeps the last two snapshots and renders an interpolated frame
 * on every requestAnimationFrame tick:
 *
 *   renderAt = now - INTERP_DELAY_MS  (100 ms = ~2 broadcast intervals)
 *   frame = lerp(prev, next, (renderAt - prev.tick) / (next.tick - prev.tick))
 *
 * Only continuous fields are interpolated (player/monster x,y). Discrete
 * fields (status, lives, score, level, scene, …) are taken from the older
 * snapshot until the newer one becomes the base — no ghost states.
 *
 * Layout caching (WIRE-1): snapshots carry innerWalls: null except after a
 * layout change. The interpolator restores cached walls by layout digest
 * so the renderer always sees a complete state object.
 */
export const INTERP_DELAY_MS = 100;

export class MultiplayerInterpolator {
    constructor() {
        this.prev = null;
        this.next = null;
        this.layoutCache = new Map(); // digest → innerWalls
    }

    reset() {
        this.prev = null;
        this.next = null;
    }

    /**
     * Push a wire snapshot (already rehydrated: innerWalls may be null).
     * Caches full layouts; restores cached walls for delta snapshots.
     * Unknown digest with null walls is passed through (renderer waits
     * for the full layout instead of drawing a wall-less maze).
     */
    push(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return;
        if (Array.isArray(snapshot.innerWalls) && snapshot.layout) {
            this.layoutCache.set(snapshot.layout, snapshot.innerWalls);
            if (this.layoutCache.size > 8) {
                const oldest = this.layoutCache.keys().next().value;
                this.layoutCache.delete(oldest);
            }
        } else if (snapshot.innerWalls == null && snapshot.layout) {
            const cached = this.layoutCache.get(snapshot.layout);
            if (cached) snapshot = { ...snapshot, innerWalls: cached };
        }
        this.prev = this.next;
        this.next = snapshot;
        // First snapshot: duplicate so interpolation has a base pair.
        if (!this.prev) this.prev = snapshot;
    }

    /**
     * Seed from the full state attached to init (WIRE-1): primes the
     * layout cache and the base pair so the first frame renders instantly.
     */
    seedFromInit(initMsg) {
        this.reset();
        const state = initMsg?.state;
        if (state && Array.isArray(state.innerWalls) && state.layout) {
            this.layoutCache.set(state.layout, state.innerWalls);
        }
        if (state) {
            const full = { ...state };
            if (full.innerWalls == null && full.layout) {
                full.innerWalls = this.layoutCache.get(full.layout) || [];
            }
            this.prev = full;
            this.next = full;
        }
    }

    /**
     * Interpolated frame for timestamp nowMs (default: performance.now()).
     * Returns null until two snapshots arrived; falls back to the newest
     * snapshot when the stream stalls (>250 ms without update).
     */
    getFrame(nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
        if (!this.next) return null;
        if (!this.prev || this.prev === this.next) return this.next;
        const renderAt = nowMs - INTERP_DELAY_MS;
        const tPrev = this.prev.tick ?? 0;
        const tNext = this.next.tick ?? 0;
        if (tNext <= tPrev) return this.next;
        // Stalled stream: don't freeze on old data, show newest.
        if (renderAt > tNext + 250 / 20) return this.next;
        const alpha = Math.min(1, Math.max(0, (renderAt - tPrev) / (tNext - tPrev)));
        if (alpha <= 0) return this.prev;
        if (alpha >= 1) return this.next;
        return this._lerpFrame(this.prev, this.next, alpha);
    }

    newest() {
        return this.next;
    }

    _lerpFrame(a, b, alpha) {
        const frame = { ...b };
        frame.players = (b.players || []).map((pb, i) => {
            const pa = (a.players || [])[i];
            if (!pa || pa.id !== pb.id) return pb;
            if (typeof pa.x !== 'number' || typeof pb.x !== 'number') return pb;
            return { ...pb, x: pa.x + (pb.x - pa.x) * alpha, y: pa.y + (pb.y - pa.y) * alpha };
        });
        frame.monsters = (b.monsters || []).map((mb, i) => {
            const ma = (a.monsters || [])[i];
            if (!ma || ma.type !== mb.type) return mb;
            if (typeof ma.x !== 'number' || typeof mb.x !== 'number') return mb;
            return { ...mb, x: ma.x + (mb.x - ma.x) * alpha, y: ma.y + (mb.y - ma.y) * alpha };
        });
        return frame;
    }
}

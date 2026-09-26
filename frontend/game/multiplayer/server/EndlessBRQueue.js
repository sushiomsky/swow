/**
 * EndlessBRQueue — Pooled Battle Royale matchmaking (POOL-1).
 *
 * Behavior:
 * - Simultaneous queue joins are pooled into ONE dungeon (up to MAX_PLAYERS).
 * - Short countdown after the first joiner collects stragglers, then launch.
 * - Each player gets their own spawn slot; remaining slots filled with bots
 *   when the pool is smaller than MIN_PLAYERS_FOR_BOTS_FILL.
 * - Solo joiner (nobody else in the window) starts immediately as before
 *   (own dungeon + bot partner).
 */
'use strict';

const WebSocket = require('ws');
const { ServerPlayer } = require('./ServerPlayer');

const MAX_PLAYERS = 4;          // one dungeon hosts up to 4 humans
const POOL_WINDOW_MS = 3000;    // collect simultaneous joins into one dungeon
const MIN_PLAYERS_FOR_BOTS_FILL = 2; // below this, pad empty slots with bots
const MATCH_STARTING_EVENT = 'match_starting';

class EndlessBRQueue {
    constructor(gameServer) {
        this.gameServer = gameServer;
        this.activePlayers = new Map(); // playerId → dungeonId
        this.waitingPlayers = new Map(); // playerId → { conn, joinedAt }
        this.poolTimer = null;
        this.metrics = { launches: 0, players_launched: 0, total_wait_ms: 0 };
        console.log('[EndlessBRQueue] Initialized (pooled)');
    }

    /**
     * Add player to endless BR pool.
     * First joiner opens a pool window; all joins within the window share
     * ONE dungeon. Max players launch instantly.
     */
    addPlayer(playerId, conn) {
        if (this.activePlayers.has(playerId) || this.waitingPlayers.has(playerId)) {
            console.warn('[EndlessBRQueue] Player already in endless BR:', playerId);
            return;
        }

        console.log('[EndlessBRQueue] Player joining pool:', playerId);
        this.waitingPlayers.set(playerId, { conn, joinedAt: Date.now() });
        this._broadcastQueueStatus();

        if (this.waitingPlayers.size >= MAX_PLAYERS) {
            this._launchGame();
            return;
        }
        if (!this.poolTimer) {
            this.poolTimer = setTimeout(() => {
                this.poolTimer = null;
                this._launchGame();
            }, POOL_WINDOW_MS);
            this._broadcastQueueStatus();
        }
    }

    /**
     * Remove player from endless BR (waiting pool or active).
     */
    removePlayer(playerId) {
        if (this.waitingPlayers.has(playerId)) {
            console.log(`[EndlessBRQueue] Player ${playerId} left pool`);
            this.waitingPlayers.delete(playerId);
            if (this.waitingPlayers.size === 0 && this.poolTimer) {
                clearTimeout(this.poolTimer);
                this.poolTimer = null;
            }
            this._broadcastQueueStatus();
            return;
        }
        if (this.activePlayers.has(playerId)) {
            const dungeonId = this.activePlayers.get(playerId);
            console.log(`[EndlessBRQueue] Player ${playerId} left dungeon ${dungeonId}`);
            this.activePlayers.delete(playerId);
        }
    }

    /**
     * Launch ONE dungeon for all pooled players.
     */
    _launchGame() {
        if (this.poolTimer) {
            clearTimeout(this.poolTimer);
            this.poolTimer = null;
        }
        if (this.waitingPlayers.size === 0) return;

        const entries = Array.from(this.waitingPlayers.entries())
            .filter(([, { conn }]) => this._isConnectionOpen(conn));
        // Drop dead connections from the pool.
        for (const [pid] of this.waitingPlayers.keys()) {
            if (!entries.some(([ePid]) => ePid === pid)) this.waitingPlayers.delete(pid);
        }
        if (entries.length === 0) return;

        console.log(`[EndlessBRQueue] Launching pooled dungeon with ${entries.length} players`);

        const dungeon = this.gameServer._createDungeon();
        dungeon.ensureSlots(Math.max(entries.length, MIN_PLAYERS_FOR_BOTS_FILL));
        dungeon.matchMode = 'endless_br';

        this._notifyMatchStarting(entries);

        const now = Date.now();
        entries.forEach(([playerId, { conn, joinedAt }], index) => {
            const player = new ServerPlayer(index, dungeon, playerId, dungeon.id);
            player.homeSlot = index;
            conn.player = player;
            conn.dungeonId = dungeon.id;
            conn.sessionId = playerId;
            conn.mode = 'endless_br';
            dungeon.addPlayer(player);
            this.activePlayers.set(playerId, dungeon.id);
            this.metrics.total_wait_ms += Math.max(0, now - joinedAt);
            this.gameServer._sendInit(conn, dungeon);
            console.log(`[EndlessBRQueue] Player ${playerId} → dungeon ${dungeon.id} slot ${index}`);
        });

        // Pad with bots when the pool is small.
        for (let slot = entries.length; slot < MIN_PLAYERS_FOR_BOTS_FILL; slot++) {
            this.gameServer.spawnBot(dungeon.id, slot);
        }

        dungeon.startGame();
        this.metrics.launches += 1;
        this.metrics.players_launched += entries.length;
        this.waitingPlayers.clear();
        this._broadcastQueueStatus();
        console.log(`[EndlessBRQueue] Pooled dungeon ${dungeon.id} launched`);
    }

    _notifyMatchStarting(entries) {
        const payload = {
            type: MATCH_STARTING_EVENT,
            message: 'Match found, launching…',
            expires_ms: 4000,
        };
        for (const [, { conn }] of entries) {
            this.gameServer._send(conn.ws, payload);
        }
    }

    _isConnectionOpen(conn) {
        return !!conn && !!conn.ws && conn.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Broadcast pool status to waiting players.
     */
    _broadcastQueueStatus() {
        const status = {
            type: 'endless_queue_status',
            players_waiting: this.waitingPlayers.size,
            max_players: MAX_PLAYERS,
            countdown_active: !!this.poolTimer,
        };
        for (const { conn } of this.waitingPlayers.values()) {
            this.gameServer._send(conn.ws, status);
        }
    }

    /**
     * Get queue snapshot for API
     */
    getSnapshot() {
        return {
            mode: 'endless',
            active_players: this.activePlayers.size,
            players_waiting: this.waitingPlayers.size,
            countdown_active: !!this.poolTimer,
            dungeons_created: this.activePlayers.size,
        };
    }
}

module.exports = { EndlessBRQueue, ENDLESS_BR_MAX_PLAYERS: MAX_PLAYERS, ENDLESS_BR_POOL_WINDOW_MS: POOL_WINDOW_MS };

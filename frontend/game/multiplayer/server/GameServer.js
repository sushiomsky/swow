/**
 * GameServer — WebSocket server for private 2-player rooms.
 *
 * NOW WITH CONNECTED DUNGEONS: Dungeons can be linked via tunnels
 * for battle royale mode. Players can travel between dungeons.
 * 
 * NOW WITH BR QUEUES: Matchmaking for Endless, Sit-n-Go, and Team modes.
 */
'use strict';

const WebSocket = require('ws');
const { DungeonInstance, STATE } = require('./DungeonInstance');
const { ServerPlayer } = require('./ServerPlayer');
const { DungeonGraph } = require('./DungeonGraph');
const { BotPlayer } = require('./BotPlayer');
const { EndlessBRQueue } = require('./EndlessBRQueue');
const { SitNGoQueue } = require('./SitNGoQueue');
const { TeamBRQueue } = require('./TeamBRQueue');

const SCAN_FPS = 50;
const TICK_MS = 1000 / SCAN_FPS;
// ROOM-1: private rooms support up to 4 players (2 previously).
const PRIVATE_ROOM_MAX_PLAYERS = 4;
// RESUME-1: reconnect grace — a disconnected player's slot stays reserved
// this long before the dungeon treats them as gone.
const RESUME_GRACE_MS = 60 * 1000;
const RESUME_TOKEN_BYTES = 16;
// WIRE-2: decouple simulation tick (50 Hz) from network broadcast.
// Snapshots go out at BROADCAST_FPS; the client interpolates between them
// (see MultiplayerInterpolator) so motion stays smooth at any frame rate
// while bandwidth drops ~60%.
const BROADCAST_FPS = 20;
const BROADCAST_EVERY_N_TICKS = Math.round(SCAN_FPS / BROADCAST_FPS);
// M-07: cap queued bytes per socket for state snapshots. If a client lags,
// its ws buffer would otherwise pile up ~50 states/s; stale snapshots are
// worthless (client only needs the newest), so drop instead of buffering.
const MAX_STATE_BUFFERED_BYTES = 256 * 1024;
const BOT_SEED_INITIAL_DELAY_MS = 15 * 1000;
const BOT_SEED_INTERVAL_MS = 60 * 1000;
const TARGET_DUNGEONS_PER_MODE = 4;

let nextPlayerId = 1;

class GameServer {
    constructor(httpServer) {
        this.wss = new WebSocket.Server({ server: httpServer });
        this.wss.on('error', (err) => {
            console.error('[GameServer] WebSocket server error:', err.message);
        });

        this.connections = new Map();
        this.dungeons = new Map();
        this.privatePairLobbies = new Map();
        
        // NEW: Dungeon graph for battle royale mode
        this.dungeonGraph = new DungeonGraph();
        this.battleRoyaleMode = process.env.BATTLE_ROYALE === 'true'; // Feature flag
        
        // NEW: Bot management
        this.bots = new Map(); // botId -> BotPlayer instance
        
        // NEW: Spectator management
        this.spectators = new Map(); // playerId -> { dungeonId, ws }
        
        // NEW: BR Queue management
        this.endlessBRQueue = new EndlessBRQueue(this);
        this.sitNGoQueue = new SitNGoQueue(this);
        this.teamEndlessQueue = new TeamBRQueue(this, 'team-endless');
        this.teamSitNGoQueue = new TeamBRQueue(this, 'team-sitngo');
        this._backgroundTimers = [];

        this.wss.on('connection', (ws) => this._onConnect(ws));
        this._loop = setInterval(() => this._tick(), TICK_MS);
        // RESUME-1: token → { playerId, dungeonId, slot, mode, expiresAt }.
        // Lets a dropped client reattach to its live slot instead of
        // starting a new dungeon.
        this._resumeTokens = new Map(); // token → resume record
        this._playerToken = new Map(); // playerId → token
        // WIRE-1/2: per-dungeon wire state — last layout digest sent (cache),
        // tick counter for broadcast decimation, last broadcast payload for
        // delta-unchanged heartbeats.
        // { layout: string|null, tickCount: number, lastWalls: array|null }
        this._wireByDungeon = new Map(); // dungeonId → wire state
        this._scheduleBackgroundBattleRoyaleBots();
        console.log(`[GameServer] started at ${TICK_MS}ms/tick`);
        console.log(`[GameServer] Battle Royale mode: ${this.battleRoyaleMode ? 'ENABLED' : 'DISABLED'}`);
        console.log('[GameServer] BR Queues initialized: Endless, Sit-n-Go, Team Endless, Team Sit-n-Go');
    }

    // ─── Connection Lifecycle ─────────────────────────────────────────────────

    _onConnect(ws) {
        try {
            const playerId = String(nextPlayerId++);
            const conn = { ws, player: null, dungeonId: null, inputs: {}, sessionId: null };
            this.connections.set(playerId, conn);

            ws.on('message', (msg) => {
                try { this._onMessage(playerId, JSON.parse(msg)); } catch (e) { console.error(`[GameServer] Message error for player ${playerId}:`, e.message); }
            });
            ws.on('close', () => this._onDisconnect(playerId));
            ws.on('error', (err) => {
                console.error(`[GameServer] WebSocket error for player ${playerId}:`, err.message);
                ws.terminate();
            });

            // Send player their assigned id so they know who they are
            this._send(ws, { type: 'connected', playerId });
            console.log(`[GameServer] player ${playerId} connected`);
        } catch (e) {
            console.error('[GameServer] Error in _onConnect:', e.message, e.stack);
            ws.terminate();
        }
    }

    _onDisconnect(playerId) {
        const conn = this.connections.get(playerId);
        if (!conn) return;

        // Remove spectator if exists
        if (this.spectators.has(playerId)) {
            this.spectators.delete(playerId);
            console.log(`[GameServer] spectator ${playerId} disconnected`);
        }

        // Remove from BR queues if waiting
        this.endlessBRQueue.removePlayer(playerId);
        this.sitNGoQueue.removePlayer(playerId);
        this.teamEndlessQueue.removePlayer(playerId);
        this.teamSitNGoQueue.removePlayer(playerId);

        if (conn.player) {
            // RESUME-1: keep the slot reserved during the grace window.
            // The player object stays seated (status frozen); a reconnect
            // with the token reattaches. Only evict after grace expiry.
            const token = this._issueResumeToken(playerId, conn);
            if (token) {
                console.log(`[GameServer] player ${playerId} disconnected — slot held for reconnect (grace ${RESUME_GRACE_MS / 1000}s)`);
            } else {
                const dungeon = this.dungeons.get(conn.dungeonId);
                if (dungeon) {
                    dungeon.removePlayer(conn.player);
                    this._checkDungeonEmpty(dungeon);
                }
            }
        }
        for (const [code, lobby] of this.privatePairLobbies.entries()) {
            if (lobby.hostId === playerId) {
                this.privatePairLobbies.delete(code);
            }
        }
        this.connections.delete(playerId);
        console.log(`[GameServer] player ${playerId} disconnected`);
    }

    _onMessage(playerId, msg) {
        const conn = this.connections.get(playerId);
        if (!conn) return;

        switch (msg.type) {
            case 'join_pair':
                this._createPrivatePair(playerId, conn);
                break;
            case 'join_private_pair':
                this._joinPrivatePair(playerId, conn, msg.code);
                break;
            case 'spectate':
                this._spectateGame(playerId, conn, msg.dungeonId);
                break;
            case 'join_endless_br':
                this._joinEndlessBR(playerId, conn);
                break;
            case 'join_sitngo_br':
                this._joinSitNGoBR(playerId, conn);
                break;
            case 'join_team_endless_br':
                this._joinTeamEndlessBR(playerId, conn);
                break;
            case 'join_team_sitngo_br':
                this._joinTeamSitNGoBR(playerId, conn);
                break;
            case 'resume_session':
                this._resumeSession(playerId, conn, msg.token);
                break;
            case 'input':
                conn.inputs = msg.keys || {};
                break;
        }
    }

    // ─── Session Resume (RESUME-1) ────────────────────────────────────────────

    /**
     * Issue a resume token for a disconnecting player. The slot stays
     * seated; the token is delivered... nowhere (socket is dead) — instead
     * it was already sent with every init, so the client has it cached.
     * Returns the token, or null when there is nothing resumable.
     */
    _issueResumeToken(playerId, conn) {
        const dungeon = this.dungeons.get(conn.dungeonId);
        if (!dungeon || dungeon.lifecycleState === STATE.DESTROYED) return null;
        if (!conn.player || conn.player.id !== playerId) return null;
        // Reuse an existing live token for this player when present.
        const existing = this._playerToken.get(playerId);
        if (existing && this._resumeTokens.has(existing)) {
            const rec = this._resumeTokens.get(existing);
            rec.expiresAt = Date.now() + RESUME_GRACE_MS;
            return existing;
        }
        const crypto = require('crypto');
        const token = crypto.randomBytes(RESUME_TOKEN_BYTES).toString('hex');
        this._resumeTokens.set(token, {
            playerId,
            dungeonId: conn.dungeonId,
            slot: conn.player.num,
            mode: conn.mode || null,
            expiresAt: Date.now() + RESUME_GRACE_MS,
        });
        this._playerToken.set(playerId, token);
        // Lazy expiry sweep.
        this._sweepResumeTokens();
        // Evict the seat when grace expires (unless resumed before).
        setTimeout(() => this._expireResumeToken(token), RESUME_GRACE_MS + 1000);
        return token;
    }

    /** Drop expired tokens (lazy sweep on issue). */
    _sweepResumeTokens() {
        const now = Date.now();
        for (const [token, rec] of this._resumeTokens.entries()) {
            if (rec.expiresAt <= now) {
                this._resumeTokens.delete(token);
                if (this._playerToken.get(rec.playerId) === token) {
                    this._playerToken.delete(rec.playerId);
                }
            }
        }
    }

    /** Grace expired without reconnect — free the seat for real. */
    _expireResumeToken(token) {
        const rec = this._resumeTokens.get(token);
        if (!rec) return;
        this._resumeTokens.delete(token);
        if (this._playerToken.get(rec.playerId) === token) {
            this._playerToken.delete(rec.playerId);
        }
        const dungeon = this.dungeons.get(rec.dungeonId);
        if (!dungeon) return;
        const seated = dungeon.players[rec.slot];
        if (seated && seated.id === rec.playerId) {
            dungeon.removePlayer(seated);
            this._checkDungeonEmpty(dungeon);
            console.log(`[GameServer] resume grace expired — evicted player ${rec.playerId} from dungeon ${rec.dungeonId}`);
        }
    }

    /**
     * Reattach a reconnected socket to its live slot.
     * Same playerId + same dungeon: full state sync, no new dungeon.
     */
    _resumeSession(newPlayerId, conn, rawToken) {
        const token = (rawToken || '').toString().trim();
        const rec = this._resumeTokens.get(token);
        if (!rec || rec.expiresAt <= Date.now()) {
            if (rec) this._resumeTokens.delete(token);
            this._send(conn.ws, { type: 'resume_error', message: 'Session expired — join a new match.' });
            return;
        }
        const dungeon = this.dungeons.get(rec.dungeonId);
        if (!dungeon || dungeon.lifecycleState === STATE.DESTROYED) {
            this._resumeTokens.delete(token);
            this._send(conn.ws, { type: 'resume_error', message: 'Match is over — join a new match.' });
            return;
        }
        const seated = dungeon.players[rec.slot];
        if (!seated || seated.id !== rec.playerId) {
            this._resumeTokens.delete(token);
            this._send(conn.ws, { type: 'resume_error', message: 'Slot no longer available — join a new match.' });
            return;
        }
        // Rebind: the new connection adopts the old playerId.
        this._resumeTokens.delete(token);
        if (this._playerToken.get(rec.playerId) === token) {
            this._playerToken.delete(rec.playerId);
        }
        // The old connection entry is gone (disconnect deleted it); the new
        // socket currently lives under newPlayerId. Move it to the old id.
        this.connections.delete(newPlayerId);
        conn.player = seated;
        conn.dungeonId = dungeon.id;
        conn.sessionId = seated.homeDungeonId === dungeon.id ? rec.playerId : conn.sessionId;
        conn.mode = rec.mode || conn.mode;
        conn.inputs = {};
        this.connections.set(rec.playerId, conn);
        // Re-issue a token for the next drop (client caches the new one).
        const crypto = require('crypto');
        const nextToken = crypto.randomBytes(RESUME_TOKEN_BYTES).toString('hex');
        this._resumeTokens.set(nextToken, {
            playerId: rec.playerId,
            dungeonId: dungeon.id,
            slot: rec.slot,
            mode: conn.mode,
            expiresAt: Date.now() + RESUME_GRACE_MS,
        });
        this._playerToken.set(rec.playerId, nextToken);
        this._send(conn.ws, {
            type: 'resumed',
            playerId: rec.playerId,
            playerNum: seated.num,
            dungeonId: dungeon.id,
            matchMode: dungeon.matchMode || null,
            resumeToken: nextToken,
            state: this._prepareWireDungeonStateFull(dungeon),
        });
        console.log(`[GameServer] player ${rec.playerId} resumed in dungeon ${dungeon.id} slot ${rec.slot}`);
    }
    
    // ─── BR Queue Handlers ────────────────────────────────────────────────────
    
    _joinEndlessBR(playerId, conn) {
        console.log('[GameServer] Player requesting endless BR:', playerId);
        this.endlessBRQueue.addPlayer(playerId, conn);
    }
    
    _joinSitNGoBR(playerId, conn) {
        console.log('[GameServer] Player requesting sit-n-go BR:', playerId);
        this.sitNGoQueue.addPlayer(playerId, conn);
    }
    
    _joinTeamEndlessBR(playerId, conn) {
        console.log('[GameServer] Player requesting team endless BR:', playerId);
        this.teamEndlessQueue.addPlayer(playerId, conn);
    }
    
    _joinTeamSitNGoBR(playerId, conn) {
        console.log('[GameServer] Player requesting team sit-n-go BR:', playerId);
        this.teamSitNGoQueue.addPlayer(playerId, conn);
    }

    // ─── Room Management ──────────────────────────────────────────────────────
    // ROOM-1: private rooms host up to PRIVATE_ROOM_MAX_PLAYERS (4) players.

    _createPrivatePair(playerId, conn) {
        if (conn.player) return;
        const dungeon = this._createDungeon();
        dungeon.ensureSlots(PRIVATE_ROOM_MAX_PLAYERS);
        dungeon.matchMode = 'classic_private_pair';
        const player = new ServerPlayer(0, dungeon, playerId, dungeon.id);
        player.homeSlot = 0;
        conn.player = player;
        conn.dungeonId = dungeon.id;
        conn.sessionId = playerId;
        conn.mode = 'classic_private_pair';
        dungeon.addPlayer(player);

        const code = this._generatePrivateCode();
        this.privatePairLobbies.set(code, { hostConn: conn, hostId: playerId, dungeon, createdAt: Date.now() });
        const joinUrl = `/multiplayer.html?room=${encodeURIComponent(code)}`;
        this._send(conn.ws, { type: 'private_pair_created', code, joinUrl, maxPlayers: PRIVATE_ROOM_MAX_PLAYERS });
        this._send(conn.ws, { type: 'waiting_for_partner' });
        this._broadcastPrivateRoomStatus(code);
        console.log(`[GameServer] private room host ${playerId} code=${code}`);
    }

    _joinPrivatePair(playerId, conn, rawCode) {
        const code = (rawCode || '').toString().trim().toUpperCase();
        const lobby = this.privatePairLobbies.get(code);
        // ROOM-1: when the lobby entry is gone the code may still belong to
        // a full room (deleted on fill). Resolve via dungeon so late joiners
        // get "full" instead of "invalid link".
        const sharedDungeon = lobby?.dungeon ?? this._findRoomDungeonByCode(code);
        if (!lobby && !sharedDungeon) {
            this._send(conn.ws, { type: 'join_error', message: 'Invalid or expired private link.' });
            return;
        }
        if (lobby && lobby.hostId === playerId) {
            this._send(conn.ws, { type: 'join_error', message: 'Invalid or expired private link.' });
            return;
        }
        if (!sharedDungeon || sharedDungeon.lifecycleState === STATE.DESTROYED) {
            this.privatePairLobbies.delete(code);
            this._send(conn.ws, { type: 'join_error', message: 'Private session is no longer available.' });
            return;
        }
        // Already in this room (e.g. re-join after disconnect)?
        const existingSlot = sharedDungeon.players.findIndex(
            (p) => p && p.id === playerId && p.homeDungeonId === sharedDungeon.id);
        const hostId = lobby ? lobby.hostId : (this._roomHostByCode?.get(code) ?? null);
        if (existingSlot >= 0) {
            conn.player = sharedDungeon.players[existingSlot];
            conn.dungeonId = sharedDungeon.id;
            conn.sessionId = hostId;
            conn.mode = 'classic_private_pair';
            this._sendInit(conn, sharedDungeon);
            this._broadcastPrivateRoomStatus(code);
            return;
        }
        const slot = this._findAvailableSlot(sharedDungeon);
        if (slot === null) {
            // Room full but lobby entry may already be gone (deleted when the
            // 4th player filled the last slot) — still report "full".
            this._send(conn.ws, { type: 'join_error', message: 'Private session is already full.' });
            return;
        }
        if (!lobby) {
            // No lobby entry (should not happen for non-full rooms) — refuse.
            this._send(conn.ws, { type: 'join_error', message: 'Invalid or expired private link.' });
            return;
        }
        const newcomer = new ServerPlayer(slot, sharedDungeon, playerId, sharedDungeon.id);
        newcomer.homeSlot = slot;
        conn.player = newcomer;
        conn.dungeonId = sharedDungeon.id;
        conn.sessionId = lobby.hostId;
        conn.mode = 'classic_private_pair';
        sharedDungeon.addPlayer(newcomer);

        // (Re)start only while nobody was playing yet: the first joiner
        // (slot 1) starts the match; later joiners hot-join the running game.
        const occupants = sharedDungeon.players.filter((p) => p && p.id !== null).length;
        if (occupants === 2) {
            sharedDungeon.startGame();
            this._sendInit(lobby.hostConn, sharedDungeon);
        }
        this._sendInit(conn, sharedDungeon);
        if (occupants >= PRIVATE_ROOM_MAX_PLAYERS) {
            // Room full — stop advertising the code but remember it so
            // further joiners get "full" instead of "invalid link".
            this.privatePairLobbies.delete(code);
            this._rememberRoomCode(code, sharedDungeon.id);
            if (!this._roomHostByCode) this._roomHostByCode = new Map();
            this._roomHostByCode.set(code, lobby.hostId);
        } else {
            this._broadcastPrivateRoomStatus(code);
        }
        console.log(`[GameServer] private room joined ${lobby.hostId} + ${playerId} slot=${slot} code=${code}`);
    }

    /**
     * ROOM-1: tell every room member who is in (player count, slots).
     * Keeps the lobby code alive until the room is full or empty.
     */
    _broadcastPrivateRoomStatus(code) {
        const lobby = this.privatePairLobbies.get(code);
        if (!lobby) return;
        const occupants = lobby.dungeon.players
            .filter((p) => p && p.id !== null)
            .map((p) => ({ slot: p.num }));
        const status = {
            type: 'private_room_status',
            code,
            playerCount: occupants.length,
            maxPlayers: PRIVATE_ROOM_MAX_PLAYERS,
            slots: occupants,
        };
        this._send(lobby.hostConn.ws, status);
        for (const [, conn] of this.connections) {
            if (conn.dungeonId === lobby.dungeon.id && conn !== lobby.hostConn && conn.player) {
                this._send(conn.ws, status);
            }
        }
    }

    /**
     * ROOM-1: resolve a room dungeon by its (expired) code. Full rooms drop
     * their lobby entry; remember code→dungeon so late joiners get "full".
     */
    _findRoomDungeonByCode(code) {
        if (!this._roomDungeonByCode) return null;
        const dungeonId = this._roomDungeonByCode.get(code);
        if (!dungeonId) return null;
        return this.dungeons.get(dungeonId) ?? null;
    }

    /** ROOM-1: remember code→dungeon (called on room create + on fill). */
    _rememberRoomCode(code, dungeonId) {
        if (!this._roomDungeonByCode) this._roomDungeonByCode = new Map();
        this._roomDungeonByCode.set(code, dungeonId);
    }
    
    // ─── Spectator Mode ───────────────────────────────────────────────────────

    _lookupDungeon(dungeonId) {
        // N-01: the browser sends the id from active-games verbatim, but be
        // tolerant about string/number mismatch in the Map lookup.
        if (dungeonId == null) return null;
        return this.dungeons.get(dungeonId)
            ?? this.dungeons.get(String(dungeonId))
            ?? this.dungeons.get(Number(dungeonId))
            ?? null;
    }

    _spectateGame(playerId, conn, dungeonId) {
        const dungeon = this._lookupDungeon(dungeonId);
        if (!dungeon) {
            this._send(conn.ws, { type: 'spectate_error', message: 'Game not found' });
            return;
        }

        // Register as spectator against the canonical id so follow-up
        // spectate_state frames (keyed by Map id) actually arrive.
        const canonicalId = dungeon.id;
        this.spectators.set(playerId, { dungeonId: canonicalId, ws: conn.ws });

        // Send initial state
        let state;
        try {
            state = dungeon.exportState();
        } catch (err) {
            console.error(`[GameServer] spectate serialize failed for dungeon ${canonicalId}:`, err.message);
            this._send(conn.ws, { type: 'spectate_error', message: 'Game state unavailable' });
            return;
        }
        this._send(conn.ws, {
            type: 'spectate_init',
            dungeonId: canonicalId,
            state
        });

        console.log(`[GameServer] player ${playerId} spectating dungeon ${canonicalId}`);
    }

    // ─── Dungeon Management ───────────────────────────────────────────────────

    _createDungeon() {
        const d = new DungeonInstance(this);
        this.dungeons.set(d.id, d);
        
        // NEW: Add to dungeon graph if battle royale mode
        if (this.battleRoyaleMode) {
            this.dungeonGraph.addDungeon(d.id);
            
            // Auto-connect to existing dungeons (ring topology)
            const connected = this.dungeonGraph.autoConnect(d.id, 2, 'ring');
            
            // Create tunnel links for connected dungeons
            connected.forEach((targetId, index) => {
                const side = index === 0 ? 'right' : 'left';
                const entrySide = side === 'right' ? 'left' : 'right';
                
                // Link this dungeon to target
                if (side === 'right') {
                    d.rightTunnelTarget = { dungeonId: targetId, entrySide };
                } else {
                    d.leftTunnelTarget = { dungeonId: targetId, entrySide };
                }
                
                // Link target back to this dungeon
                const targetDungeon = this.dungeons.get(targetId);
                if (targetDungeon) {
                    if (entrySide === 'right') {
                        targetDungeon.rightTunnelTarget = { dungeonId: d.id, entrySide: side };
                    } else {
                        targetDungeon.leftTunnelTarget = { dungeonId: d.id, entrySide: side };
                    }
                }
                
                console.log(`[GameServer] Linked dungeon ${d.id} (${side}) ←→ ${targetId} (${entrySide})`);
            });
            
            // Log graph stats
            const stats = this.dungeonGraph.getStats();
            console.log(`[GameServer] Graph: ${stats.dungeonCount} dungeons, ${stats.uniqueConnections} connections`);
        }
        
        return d;
    }

    _checkDungeonEmpty(dungeon) {
        const hasRealPlayers = dungeon.players.some(p => p && p.id !== null);
        if (!hasRealPlayers && dungeon.lifecycleState !== STATE.DESTROYED) {
            this._removePrivateLobbyByDungeonId(dungeon.id);
            this.onDungeonDestroyed(dungeon.id);
        }
    }

    onDungeonDestroyed(dungeonId) {
        this.removeBotsFromDungeon(dungeonId);
        this.dungeons.delete(dungeonId);
        if (this._wireByDungeon) this._wireByDungeon.delete(dungeonId);
        
        // NEW: Remove from graph if battle royale mode
        if (this.battleRoyaleMode) {
            this.dungeonGraph.removeDungeon(dungeonId);
        }
        
        console.log(`[GameServer] dungeon ${dungeonId} destroyed`);
    }

    /**
     * Send match_end message to eliminated players with their final stats.
     * Called by DungeonInstance._checkLifecycle() when home players are eliminated.
     */
    notifyPlayersEliminated(players, dungeon) {
        const duration = Date.now() - new Date(dungeon.createdAt).getTime();
        for (const player of players) {
            if (!player.id) continue;
            // Skip bots
            if (this.bots.has(player.id)) continue;
            const conn = this.connections.get(player.id);
            if (!conn) continue;
            this._send(conn.ws, {
                type: 'match_end',
                stats: {
                    score: player.score,
                    level: dungeon.level,
                    matchMode: dungeon.matchMode,
                    dungeonId: dungeon.id,
                    duration,
                },
            });
        }
    }

    /**
     * Transfer a visiting player back to their home dungeon after dying abroad.
     * Called by DungeonInstance.respawnPlayer() for non-home players.
     */
    respawnPlayerInHome(player) {
        const homeDungeon = this.dungeons.get(player.homeDungeonId);
        if (!homeDungeon || homeDungeon.lifecycleState === STATE.DESTROYED) {
            // Home dungeon already collapsed — player is eliminated
            console.log(`[GameServer] player ${player.id} home dungeon gone — eliminated`);
            return;
        }
        const slot = this._findAvailableSlot(homeDungeon);
        if (slot === null) {
            console.warn(`[GameServer] player ${player.id} home dungeon full`);
            return;
        }
        player.num = slot;
        homeDungeon.addPlayer(player);

        // Update connection to point at home dungeon
        const conn = this.connections.get(player.id);
        if (conn) {
            conn.dungeonId = homeDungeon.id;
            this._sendInit(conn, homeDungeon);
        }
        player.goToStartPosition();
    }
    
    // ─── Cross-Dungeon Transfer ───────────────────────────────────────────────
    
    /**
     * Transfer a player from one dungeon to another via tunnel
     * Called by DungeonInstance.tunnelTransfer()
     * 
     * @param {ServerPlayer} player - The player to transfer
     * @param {DungeonInstance} sourceDungeon - Current dungeon
     * @param {string} targetDungeonId - Destination dungeon ID
     * @param {string} entrySide - 'left' or 'right' (where player enters)
     */
    transferPlayerToDungeon(player, sourceDungeon, targetDungeonId, entrySide) {
        console.log(`[Transfer] Player ${player.id} from ${sourceDungeon.id} → ${targetDungeonId} (${entrySide})`);
        
        // Get target dungeon
        const targetDungeon = this.dungeons.get(targetDungeonId);
        if (!targetDungeon) {
            console.error(`[Transfer] Target dungeon ${targetDungeonId} not found`);
            return false;
        }
        
        // Check if target dungeon has space
        const availableSlot = this._findAvailableSlot(targetDungeon);
        if (availableSlot === null) {
            console.warn(`[Transfer] Target dungeon ${targetDungeonId} is full`);
            // TODO: Send error message to client
            return false;
        }
        
        // Save player state
        const savedState = {
            score: player.score,
            lives: player.lives,
            status: player.status,
            // Don't save position - spawn at tunnel entrance
        };
        
        // Get connection for this player
        const conn = this.connections.get(player.id);
        if (!conn) {
            console.error(`[Transfer] No connection found for player ${player.id}`);
            return false;
        }
        
        // Remove player from source dungeon
        sourceDungeon.removePlayer(player);
        
        // Broadcast to source dungeon that player left
        this._broadcastToDungeon(sourceDungeon, {
            type: 'player_left_via_tunnel',
            playerId: player.id,
            targetDungeonId: targetDungeonId
        }, player.id);
        
        // Create new player in target dungeon
        const newPlayer = new ServerPlayer(availableSlot, targetDungeon, player.id, targetDungeon.id);
        newPlayer.homeSlot = availableSlot;
        newPlayer.score = savedState.score;
        newPlayer.lives = savedState.lives;
        newPlayer.status = savedState.status;
        
        // Spawn at tunnel entrance position
        if (entrySide === 'right') {
            newPlayer.d = 'right';
            newPlayer.col = 1;
            newPlayer.x = 34; // Right side entrance
        } else {
            newPlayer.d = 'left';
            newPlayer.col = 11;
            newPlayer.x = 274; // Left side entrance
        }
        
        targetDungeon.addPlayer(newPlayer);
        
        // Update connection
        conn.player = newPlayer;
        conn.dungeonId = targetDungeon.id;
        
        // Send full dungeon init to transferred player
        this._sendInit(conn, targetDungeon);
        
        // Broadcast to target dungeon that player arrived
        this._broadcastToDungeon(targetDungeon, {
            type: 'player_arrived_via_tunnel',
            playerId: player.id,
            playerSlot: availableSlot,
            entrySide: entrySide
        }, player.id);
        
        console.log(`[Transfer] SUCCESS: Player ${player.id} now in ${targetDungeon.id} (slot ${availableSlot})`);
        return true;
    }
    
    /**
     * Find an available player slot in a dungeon
     * @returns {number|null} - Slot index (0 or 1) or null if full
     */
    _findAvailableSlot(dungeon) {
        for (let i = 0; i < dungeon.players.length; i++) {
            if (!dungeon.players[i] || dungeon.players[i].id === null) {
                return i;
            }
        }
        return null;
    }
    
    /**
     * Broadcast a message to all players in a dungeon
     * @param {DungeonInstance} dungeon
     * @param {object} message
     * @param {string} excludePlayerId - Optional player ID to exclude
     */
    _broadcastToDungeon(dungeon, message, excludePlayerId = null) {
        for (const [playerId, conn] of this.connections.entries()) {
            if (conn.dungeonId === dungeon.id && playerId !== excludePlayerId) {
                this._send(conn.ws, message);
            }
        }
    }

    // ─── Game Loop ────────────────────────────────────────────────────────────

    _tick() {
        // Build inputs map: playerId → controls (including bots)
        const inputsMap = {};
        
        // Real player inputs
        for (const [playerId, conn] of this.connections) {
            if (conn.player) inputsMap[playerId] = conn.inputs;
        }
        
        // Bot inputs
        for (const [botId, bot] of this.bots) {
            inputsMap[botId] = bot.generateInput();
        }

        // Tick all dungeons and serialize each dungeon state once.
        // N-02: isolate a faulty dungeon — one bad serialize() must not kill
        // the process (and with it every session on this server).
        // WIRE-2: simulate every tick (50 Hz) but broadcast only every Nth
        // tick (20 Hz). The client interpolates between snapshots.
        const serializedByDungeon = new Map();
        for (const [dungeonId, dungeon] of this.dungeons) {
            try {
                dungeon.tick(inputsMap);
                let wire = this._wireByDungeon.get(dungeonId);
                if (!wire) {
                    wire = { layout: null, tickCount: 0, lastWalls: null };
                    this._wireByDungeon.set(dungeonId, wire);
                }
                wire.tickCount++;
                if (wire.tickCount % BROADCAST_EVERY_N_TICKS !== 0) continue;
                serializedByDungeon.set(dungeonId, this._prepareWireDungeonState(dungeon, wire));
            } catch (err) {
                console.error(`[GameServer] Tick/serialize failed for dungeon ${dungeonId}:`, err.message);
            }
        }

        // Broadcast state to all connected players
        for (const [, conn] of this.connections) {
            if (!conn.player || !conn.dungeonId) continue;
            const serializedState = serializedByDungeon.get(conn.dungeonId);
            if (!serializedState) continue;
            this._sendSerializedState(conn, serializedState);
        }
        
        // Broadcast to spectators at reduced rate (2 FPS = every 10 ticks)
        if (this._tickCount % 10 === 0) {
            this._broadcastToSpectators(serializedByDungeon);
        }
        this._tickCount = (this._tickCount || 0) + 1;
    }

    _broadcastDungeonState(dungeon) {
        const serializedState = this._prepareSerializedDungeonState(dungeon);
        for (const [, conn] of this.connections) {
            if (conn.dungeonId === dungeon.id) {
                this._sendSerializedState(conn, serializedState);
            }
        }
    }
    
    _broadcastToSpectators(serializedByDungeon) {
        // N-06: spectators expect a state OBJECT (msg.state.players), not the
        // M-07 serialized string fragment used for the player fast path.
        // Parse once per dungeon so multiple spectators share the object.
        const parsedByDungeon = new Map();
        const getStateObject = (dungeonId) => {
            if (parsedByDungeon.has(dungeonId)) return parsedByDungeon.get(dungeonId);
            const serializedState = serializedByDungeon.get(dungeonId);
            if (!serializedState) return null;
            try {
                const state = JSON.parse(`${serializedState}}`);
                parsedByDungeon.set(dungeonId, state);
                return state;
            } catch (err) {
                console.error(`[GameServer] Failed to parse state for spectators of dungeon ${dungeonId}:`, err.message);
                return null;
            }
        };
        for (const [playerId, spectator] of this.spectators) {
            const { dungeonId, ws } = spectator;
            const state = getStateObject(dungeonId);
            if (!state) continue;

            // Send spectator-specific state (read-only)
            try {
                this._send(ws, {
                    type: 'spectate_state',
                    dungeonId,
                    state
                });
            } catch (err) {
                console.error(`[GameServer] Failed to send to spectator ${playerId}:`, err);
                this.spectators.delete(playerId);
            }
        }
    }

    _prepareSerializedDungeonState(dungeon) {
        const state = dungeon.serialize();
        state.sounds = dungeon.drainSounds();
        const serializedState = JSON.stringify(state);
        return serializedState.slice(0, -1);
    }

    /**
     * WIRE-1: build the wire-optimized broadcast fragment for a dungeon.
     * Sends full innerWalls only when the layout digest changed since the
     * last broadcast (client caches by digest); otherwise sends the digest
     * and null walls. Sounds are drained every broadcast tick so audio
     * cues are never lost by decimation.
     */
    _prepareWireDungeonState(dungeon, wire) {
        const digest = dungeon.layoutDigest();
        const includeLayout = wire.layout !== digest;
        const state = dungeon.serializeWire(includeLayout);
        if (includeLayout) {
            wire.layout = digest;
            if (Array.isArray(state.innerWalls) && state.innerWalls.length) wire.lastWalls = state.innerWalls;
            // Fresh dungeon without parsed walls: keep digest open so the
            // first real layout is sent as soon as nextDungeon() parses it.
            if (!state.innerWalls || state.innerWalls.length === 0) wire.layout = null;
        }
        state.sounds = dungeon.drainSounds();
        return JSON.stringify(state).slice(0, -1);
    }

    /** WIRE-1: full snapshot for late joiners / transfers (always with layout). */
    _prepareWireDungeonStateFull(dungeon) {
        const state = dungeon.serializeWire(true);
        state.sounds = [];
        // A fresh dungeon (title/getReady, dungeonNumber -1) has no parsed
        // walls yet; the client would render a wall-less maze. Rehydrate
        // from the last broadcast layout when digest matches, else send the
        // live (possibly empty) list — the first layout broadcast repairs it.
        if ((!state.innerWalls || state.innerWalls.length === 0) && state.layout) {
            const wire = this._wireByDungeon.get(dungeon.id);
            if (wire && wire.layout === state.layout && wire.lastWalls) {
                state.innerWalls = wire.lastWalls;
            }
        }
        const wire = this._wireByDungeon.get(dungeon.id);
        if (wire) {
            wire.layout = dungeon.layoutDigest();
            if (Array.isArray(state.innerWalls) && state.innerWalls.length) wire.lastWalls = state.innerWalls;
        }
        return state;
    }

    _sendSerializedState(conn, serializedStateWithoutBrace) {
        const myPlayerId = conn.player ? conn.player.id : null;
        const ws = conn.ws;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        // M-07: stale snapshots are worthless - drop the tick instead of
        // queuing behind a lagging client (buffer only the newest state).
        if (typeof ws.bufferedAmount === 'number' && ws.bufferedAmount > MAX_STATE_BUFFERED_BYTES) {
            conn.droppedStates = (conn.droppedStates || 0) + 1;
            return;
        }
        this._sendRaw(
            ws,
            `{"type":"state","state":${serializedStateWithoutBrace},"myPlayerId":${JSON.stringify(myPlayerId)}}}`
        );
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    _sendInit(conn, dungeon) {
        this._send(conn.ws, {
            type: 'init',
            playerId: conn.player.id,
            playerNum: conn.player.num,
            dungeonId: dungeon.id,
            matchMode: dungeon.matchMode || null,
            // WIRE-1: late joiners get the full layout with init so the first
            // decimated snapshots (innerWalls: null) render immediately.
            state: this._prepareWireDungeonStateFull(dungeon),
            // RESUME-1: token for reconnecting to this slot after a drop.
            resumeToken: this._tokenForPlayer(conn.player.id, dungeon.id, conn.player.num, conn.mode),
        });
    }

    /**
     * RESUME-1: return (creating if needed) the live resume token for a
     * seated player. Sent with every init so the client can cache it.
     */
    _tokenForPlayer(playerId, dungeonId, slot, mode) {
        const existing = this._playerToken.get(playerId);
        if (existing && this._resumeTokens.has(existing)) {
            return existing;
        }
        const crypto = require('crypto');
        const token = crypto.randomBytes(RESUME_TOKEN_BYTES).toString('hex');
        this._resumeTokens.set(token, {
            playerId, dungeonId, slot, mode: mode || null,
            expiresAt: Date.now() + RESUME_GRACE_MS,
        });
        this._playerToken.set(playerId, token);
        setTimeout(() => this._expireResumeToken(token), RESUME_GRACE_MS + 1000);
        return token;
    }

    _generatePrivateCode() {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        do {
            code = '';
            for (let i = 0; i < 6; i++) {
                code += alphabet[Math.floor(Math.random() * alphabet.length)];
            }
        } while (this.privatePairLobbies.has(code));
        return code;
    }

    _removePrivateLobbyByDungeonId(dungeonId) {
        for (const [code, lobby] of this.privatePairLobbies.entries()) {
            if (lobby?.dungeon?.id === dungeonId) {
                this.privatePairLobbies.delete(code);
            }
        }
    }

    _hasWaitingPrivateLobby(dungeonId) {
        for (const [, lobby] of this.privatePairLobbies.entries()) {
            if (lobby?.dungeon?.id === dungeonId) return true;
        }
        return false;
    }

    getActiveGamesSnapshot() {
        const games = [];
        for (const [dungeonId, dungeon] of this.dungeons.entries()) {
            if (dungeon.lifecycleState === STATE.DESTROYED) continue;
            const players = dungeon.players.filter((player) => player && player.id !== null);
            if (!players.length) continue;
            const waitingPrivateLobby = this._hasWaitingPrivateLobby(dungeonId);
            const mode = this._toSnapshotMode(dungeon.matchMode);
            games.push({
                dungeon_id: dungeonId,
                mode,
                status: waitingPrivateLobby ? 'waiting_for_partner' : 'in_progress',
                player_count: players.length,
                max_players: dungeon.players.length,
                joinable: !waitingPrivateLobby && ['endless', 'sitngo', 'team-endless', 'team-sitngo'].includes(mode),
                created_at: dungeon.createdAt,
                players: players.map((player) => ({
                    id: player.id,
                    isBot: !!player.isBot,
                })),
            });
        }
        return {
            total_games: games.length,
            total_players: games.reduce((sum, g) => sum + g.player_count, 0),
            queued_sitngo_players: this.sitNGoQueue ? this.sitNGoQueue.getWaitingCount() : 0,
            queued_team_sitngo_players: this.teamSitNGoQueue ? (this.teamSitNGoQueue.waitingPlayers ? this.teamSitNGoQueue.waitingPlayers.size : 0) : 0,
            games,
        };
    }

    _scheduleBackgroundBattleRoyaleBots() {
        const schedule = (delayMs, intervalMs, callback) => {
            const timeoutId = setTimeout(() => {
                callback();
                const intervalId = setInterval(callback, intervalMs);
                this._backgroundTimers.push(intervalId);
            }, delayMs);
            this._backgroundTimers.push(timeoutId);
        };

        schedule(BOT_SEED_INITIAL_DELAY_MS, BOT_SEED_INTERVAL_MS, () => this._seedEndlessBattleRoyaleBots());
        schedule(BOT_SEED_INITIAL_DELAY_MS, BOT_SEED_INTERVAL_MS, () => this._seedSitNGoBattleRoyaleBots());
        schedule(BOT_SEED_INITIAL_DELAY_MS, BOT_SEED_INTERVAL_MS, () => this._seedTeamEndlessBots());
        schedule(BOT_SEED_INITIAL_DELAY_MS, BOT_SEED_INTERVAL_MS, () => this._seedTeamSitNGoBots());
    }

    _seedEndlessBattleRoyaleBots() {
        const needed = TARGET_DUNGEONS_PER_MODE - this._countActiveMatchesByMode('endless_br');
        for (let i = 0; i < needed; i++) this._seedBotOnlyMatch('endless_br');
    }

    _seedSitNGoBattleRoyaleBots() {
        if (this.sitNGoQueue.getWaitingCount() > 0) this.sitNGoQueue.launchWithBots();
        const needed = TARGET_DUNGEONS_PER_MODE - this._countActiveMatchesByMode('sitngo_br');
        for (let i = 0; i < needed; i++) this._seedBotOnlyMatch('sitngo_br');
    }

    _seedTeamEndlessBots() {
        const needed = TARGET_DUNGEONS_PER_MODE - this._countActiveMatchesByMode('team_endless_br');
        for (let i = 0; i < needed; i++) this._seedBotOnlyMatch('team_endless_br');
    }

    _seedTeamSitNGoBots() {
        const needed = TARGET_DUNGEONS_PER_MODE - this._countActiveMatchesByMode('team_sitngo_br');
        for (let i = 0; i < needed; i++) this._seedBotOnlyMatch('team_sitngo_br');
    }

    _seedBotOnlyMatch(matchMode) {
        const dungeon = this._createDungeon();
        dungeon.matchMode = matchMode;
        this.spawnBot(dungeon.id, 0);
        this.spawnBot(dungeon.id, 1);
        dungeon.startGame();
        console.log(`[GameServer] Seeded background ${matchMode} match in dungeon ${dungeon.id}`);
    }

    _countActiveMatchesByMode(matchMode) {
        let count = 0;
        for (const dungeon of this.dungeons.values()) {
            if (dungeon.lifecycleState === STATE.DESTROYED) continue;
            if (dungeon.matchMode === matchMode) count++;
        }
        return count;
    }

    _toSnapshotMode(matchMode) {
        const modes = {
            endless_br: 'endless',
            sitngo_br: 'sitngo',
            team_endless_br: 'team-endless',
            team_sitngo_br: 'team-sitngo',
            classic_private_pair: 'private',
        };
        return modes[matchMode] || 'private';
    }
    
    // Get dungeon topology for mini-map visualization
    getDungeonTopology() {
        const dungeons = [];
        
        for (const [dungeonId, dungeon] of this.dungeons.entries()) {
            if (dungeon.lifecycleState === STATE.DESTROYED) continue;

            const players = dungeon.players.filter((player) => player && player.id !== null);
            
            dungeons.push({
                id: dungeonId,
                lifecycle_state: dungeon.lifecycleState,
                player_count: players.length,
                level: dungeon.level,
                scene: dungeon.scene,
                connections: {
                    left: dungeon.leftTunnelTarget ? dungeon.leftTunnelTarget.dungeonId : null,
                    right: dungeon.rightTunnelTarget ? dungeon.rightTunnelTarget.dungeonId : null
                },
                players: players.map(p => ({
                    id: p.id,
                    lives: p.lives,
                    score: p.score,
                    status: p.status
                }))
            });
        }
        
        return {
            dungeons,
            total_dungeons: dungeons.length,
            topology: this.battleRoyaleMode ? 'ring' : 'independent'
        };
    }

    _send(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    _sendRaw(ws, rawData) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(rawData);
        }
    }

    // ─── Bot Management ───────────────────────────────────────────────────────

    /**
     * Spawn a bot in a dungeon
     * @param {string} dungeonId - Target dungeon ID
     * @param {number} playerSlot - Player slot (0 or 1)
     * @returns {BotPlayer} The spawned bot
     */
    spawnBot(dungeonId, playerSlot) {
        const dungeon = this.dungeons.get(dungeonId);
        if (!dungeon) {
            console.error('[Bot] Cannot spawn bot: dungeon not found:', dungeonId);
            return null;
        }

        const bot = new BotPlayer(dungeonId, playerSlot);
        this.bots.set(bot.id, bot);

        // Add bot as a player in the dungeon
        const serverPlayer = new ServerPlayer(playerSlot, dungeon, bot.id, dungeon.id);
        serverPlayer.isBot = true;
        serverPlayer.homeSlot = playerSlot;
        dungeon.addPlayer(serverPlayer);

        console.log('[Bot] Spawned bot', bot.name, 'in dungeon', dungeonId, 'slot', playerSlot);
        return bot;
    }

    /**
     * Remove a bot
     * @param {string} botId - Bot ID to remove
     */
    removeBot(botId) {
        const bot = this.bots.get(botId);
        if (!bot) return;

        // Remove from dungeon — restore the slot placeholder so engine code
        // can always rely on players[i] being a PlaceholderPlayer-or-better
        // (never null). N-02: direct null assignment crashed serialize().
        const dungeon = this.dungeons.get(bot.dungeonId);
        if (dungeon && dungeon.players[bot.playerSlot]?.id === botId) {
            const { PlaceholderPlayer } = require('./ServerPlayer');
            dungeon.players[bot.playerSlot] = new PlaceholderPlayer(bot.playerSlot);
            dungeon.numOfPlayers = dungeon.players.filter((p) => p && p.id !== null).length;
        }

        this.bots.delete(botId);
        console.log('[Bot] Removed bot', bot.name, 'from dungeon', bot.dungeonId);
    }

    /**
     * Remove all bots from a dungeon
     * @param {string} dungeonId - Dungeon ID
     */
    removeBotsFromDungeon(dungeonId) {
        const botsToRemove = [];
        for (const [botId, bot] of this.bots) {
            if (bot.dungeonId === dungeonId) {
                botsToRemove.push(botId);
            }
        }
        botsToRemove.forEach(botId => this.removeBot(botId));
    }

    /**
     * Check if a player slot is occupied by a bot
     * @param {string} dungeonId
     * @param {number} playerSlot
     * @returns {boolean}
     */
    isBotInSlot(dungeonId, playerSlot) {
        for (const bot of this.bots.values()) {
            if (bot.dungeonId === dungeonId && bot.playerSlot === playerSlot) {
                return true;
            }
        }
        return false;
    }

    /** Stops the game loop and closes the WebSocket server. */
    stop() {
        clearInterval(this._loop);
        this._backgroundTimers.forEach((timerId) => clearTimeout(timerId));
        this._backgroundTimers = [];
        this.wss.close();
    }
}

module.exports = { GameServer, PRIVATE_ROOM_MAX_PLAYERS, RESUME_GRACE_MS };

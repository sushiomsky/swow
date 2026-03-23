/**
 * GameServer — WebSocket server for private 2-player rooms.
 *
 * Minimal multiplayer: create a room, share a code/link, friend joins, game starts.
 * No matchmaking, no queues, no cross-dungeon tunnels.
 */
'use strict';

const WebSocket = require('ws');
const { DungeonInstance, STATE } = require('./DungeonInstance');
const { ServerPlayer } = require('./ServerPlayer');

const SCAN_FPS = 50;
const TICK_MS = 1000 / SCAN_FPS;

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

        this.wss.on('connection', (ws) => this._onConnect(ws));
        this._loop = setInterval(() => this._tick(), TICK_MS);
        console.log(`[GameServer] started at ${TICK_MS}ms/tick`);
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
        if (conn.player) {
            const dungeon = this.dungeons.get(conn.dungeonId);
            if (dungeon) {
                dungeon.removePlayer(conn.player);
                this._checkDungeonEmpty(dungeon);
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
            case 'input':
                conn.inputs = msg.keys || {};
                break;
        }
    }

    // ─── Room Management ──────────────────────────────────────────────────────

    _createPrivatePair(playerId, conn) {
        if (conn.player) return;
        const dungeon = this._createDungeon();
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
        const joinUrl = `/?room=${encodeURIComponent(code)}`;
        this._send(conn.ws, { type: 'private_pair_created', code, joinUrl });
        this._send(conn.ws, { type: 'waiting_for_partner' });
        console.log(`[GameServer] private pair host ${playerId} code=${code}`);
    }

    _joinPrivatePair(playerId, conn, rawCode) {
        const code = (rawCode || '').toString().trim().toUpperCase();
        const lobby = this.privatePairLobbies.get(code);
        if (!lobby || lobby.hostId === playerId) {
            this._send(conn.ws, { type: 'join_error', message: 'Invalid or expired private link.' });
            return;
        }
        const sharedDungeon = lobby.dungeon;
        if (!sharedDungeon || sharedDungeon.lifecycleState === STATE.DESTROYED) {
            this.privatePairLobbies.delete(code);
            this._send(conn.ws, { type: 'join_error', message: 'Private session is no longer available.' });
            return;
        }
        if (sharedDungeon.players[1] && sharedDungeon.players[1].id !== null) {
            this.privatePairLobbies.delete(code);
            this._send(conn.ws, { type: 'join_error', message: 'Private session is already full.' });
            return;
        }
        const player2 = new ServerPlayer(1, sharedDungeon, playerId, sharedDungeon.id);
        player2.homeSlot = 1;
        conn.player = player2;
        conn.dungeonId = sharedDungeon.id;
        conn.sessionId = lobby.hostId;
        conn.mode = 'classic_private_pair';
        sharedDungeon.addPlayer(player2);

        sharedDungeon.startGame();
        this._sendInit(lobby.hostConn, sharedDungeon);
        this._sendInit(conn, sharedDungeon);
        this.privatePairLobbies.delete(code);
        console.log(`[GameServer] private pair joined ${lobby.hostId} + ${playerId} code=${code}`);
    }

    // ─── Dungeon Management ───────────────────────────────────────────────────

    _createDungeon() {
        const d = new DungeonInstance(this);
        this.dungeons.set(d.id, d);
        return d;
    }

    _checkDungeonEmpty(dungeon) {
        const hasRealPlayers = dungeon.players.some(p => p.id !== null);
        if (!hasRealPlayers && dungeon.lifecycleState !== STATE.DESTROYED) {
            this._removePrivateLobbyByDungeonId(dungeon.id);
            this.onDungeonDestroyed(dungeon.id);
        }
    }

    onDungeonDestroyed(dungeonId) {
        this.dungeons.delete(dungeonId);
        console.log(`[GameServer] dungeon ${dungeonId} destroyed`);
    }

    // ─── Game Loop ────────────────────────────────────────────────────────────

    _tick() {
        // Build inputs map: playerId → controls
        const inputsMap = {};
        for (const [playerId, conn] of this.connections) {
            if (conn.player) inputsMap[playerId] = conn.inputs;
        }

        // Tick all dungeons and serialize each dungeon state once.
        const serializedByDungeon = new Map();
        for (const [dungeonId, dungeon] of this.dungeons) {
            dungeon.tick(inputsMap);
            serializedByDungeon.set(dungeonId, this._prepareSerializedDungeonState(dungeon));
        }

        // Broadcast state to all connected players
        for (const [, conn] of this.connections) {
            if (!conn.player || !conn.dungeonId) continue;
            const serializedState = serializedByDungeon.get(conn.dungeonId);
            if (!serializedState) continue;
            this._sendSerializedState(conn, serializedState);
        }
    }

    _broadcastDungeonState(dungeon) {
        const serializedState = this._prepareSerializedDungeonState(dungeon);
        for (const [, conn] of this.connections) {
            if (conn.dungeonId === dungeon.id) {
                this._sendSerializedState(conn, serializedState);
            }
        }
    }

    _prepareSerializedDungeonState(dungeon) {
        const state = dungeon.serialize();
        state.sounds = dungeon.drainSounds();
        const serializedState = JSON.stringify(state);
        return serializedState.slice(0, -1);
    }

    _sendSerializedState(conn, serializedStateWithoutBrace) {
        const myPlayerId = conn.player ? conn.player.id : null;
        this._sendRaw(
            conn.ws,
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
        });
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
            const players = dungeon.players.filter((player) => player.id !== null);
            if (!players.length) continue;
            const waitingPrivateLobby = this._hasWaitingPrivateLobby(dungeonId);
            games.push({
                dungeon_id: dungeonId,
                status: waitingPrivateLobby ? 'waiting_for_partner' : 'in_progress',
                player_count: players.length,
                max_players: 2,
            });
        }
        return {
            total_games: games.length,
            total_players: games.reduce((sum, g) => sum + g.player_count, 0),
            games,
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

    /** Stops the game loop and closes the WebSocket server. */
    stop() {
        clearInterval(this._loop);
        this.wss.close();
    }
}

module.exports = { GameServer };

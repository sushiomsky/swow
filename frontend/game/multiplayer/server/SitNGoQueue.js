/**
 * SitNGoQueue — Tournament-style Battle Royale queue
 * 
 * Behavior:
 * - Players queue up and wait for minimum threshold
 * - When MIN_PLAYERS reached, start countdown timer
 * - When timer expires OR MAX_PLAYERS reached, launch game
 * - All players start simultaneously in connected dungeons
 * - Fill remaining slots with bots
 * 
 * This is classic "sit and go" tournament style.
 */

'use strict';

const MIN_PLAYERS = 2;  // Minimum to start countdown
const MAX_PLAYERS = 8;  // Maximum before instant start
const COUNTDOWN_MS = 15000;  // 15 seconds after MIN_PLAYERS

class SitNGoQueue {
    constructor(gameServer) {
        this.gameServer = gameServer;
        this.waitingPlayers = new Map(); // playerId → { conn, joinedAt }
        this.countdownTimer = null;
        this.countdownStartedAt = null;
        console.log('[SitNGoQueue] Initialized');
    }
    
    /**
     * Add player to sit-n-go queue
     */
    addPlayer(playerId, conn) {
        if (this.waitingPlayers.has(playerId)) {
            console.warn('[SitNGoQueue] Player already in queue:', playerId);
            return;
        }
        
        console.log('[SitNGoQueue] Player joining queue:', playerId);
        
        this.waitingPlayers.set(playerId, {
            conn,
            joinedAt: Date.now()
        });
        
        // Send queue status
        this._broadcastQueueStatus();
        
        // Check if we should start countdown
        if (this.waitingPlayers.size >= MIN_PLAYERS && !this.countdownTimer) {
            this._startCountdown();
        }
        
        // Check if we hit max players (instant start)
        if (this.waitingPlayers.size >= MAX_PLAYERS) {
            console.log('[SitNGoQueue] Max players reached, starting immediately');
            this._launchGame();
        }
    }
    
    /**
     * Remove player from queue
     */
    removePlayer(playerId) {
        if (!this.waitingPlayers.has(playerId)) {
            return;
        }
        
        console.log('[SitNGoQueue] Player left queue:', playerId);
        this.waitingPlayers.delete(playerId);
        
        // Cancel countdown if we drop below minimum
        if (this.waitingPlayers.size < MIN_PLAYERS && this.countdownTimer) {
            this._cancelCountdown();
        }
        
        this._broadcastQueueStatus();
    }
    
    /**
     * Start countdown timer
     */
    _startCountdown() {
        if (this.countdownTimer) return;
        
        console.log(`[SitNGoQueue] Starting countdown: ${COUNTDOWN_MS}ms`);
        this.countdownStartedAt = Date.now();
        
        this.countdownTimer = setTimeout(() => {
            this._launchGame();
        }, COUNTDOWN_MS);
        
        this._broadcastQueueStatus();
    }
    
    /**
     * Cancel countdown
     */
    _cancelCountdown() {
        if (!this.countdownTimer) return;
        
        console.log('[SitNGoQueue] Countdown cancelled');
        clearTimeout(this.countdownTimer);
        this.countdownTimer = null;
        this.countdownStartedAt = null;
        
        this._broadcastQueueStatus();
    }
    
    /**
     * Launch the game with all queued players
     */
    _launchGame() {
        if (this.waitingPlayers.size === 0) {
            console.warn('[SitNGoQueue] Cannot launch game: no players');
            return;
        }
        
        console.log(`[SitNGoQueue] Launching game with ${this.waitingPlayers.size} players`);
        
        // Cancel countdown
        if (this.countdownTimer) {
            clearTimeout(this.countdownTimer);
            this.countdownTimer = null;
            this.countdownStartedAt = null;
        }
        
        const ServerPlayer = require('./ServerPlayer').ServerPlayer;
        const players = Array.from(this.waitingPlayers.entries());
        
        // Create dungeon for each player
        players.forEach(([playerId, { conn }], index) => {
            const dungeon = this.gameServer._createDungeon();
            
            // Add real player in slot 0
            const player = new ServerPlayer(0, dungeon, playerId, dungeon.id);
            player.homeSlot = 0;
            conn.player = player;
            conn.dungeonId = dungeon.id;
            conn.sessionId = playerId;
            conn.mode = 'sitngo_br';
            dungeon.addPlayer(player);
            
            // Spawn bot in slot 1
            this.gameServer.spawnBot(dungeon.id, 1);
            
            // Start game
            dungeon.startGame();
            
            // Send init
            this.gameServer._sendInit(conn, dungeon);
            
            console.log(`[SitNGoQueue] Player ${playerId} → dungeon ${dungeon.id}`);
        });
        
        // Clear queue
        this.waitingPlayers.clear();
        
        console.log('[SitNGoQueue] Game launched successfully');
    }
    
    /**
     * Broadcast queue status to all waiting players
     */
    _broadcastQueueStatus() {
        const status = {
            type: 'sitngo_queue_status',
            players_waiting: this.waitingPlayers.size,
            min_players: MIN_PLAYERS,
            max_players: MAX_PLAYERS,
            countdown_active: !!this.countdownTimer,
            countdown_remaining: this.countdownTimer ? 
                Math.max(0, COUNTDOWN_MS - (Date.now() - this.countdownStartedAt)) : null
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
            mode: 'sitngo',
            players_waiting: this.waitingPlayers.size,
            countdown_active: !!this.countdownTimer,
            countdown_remaining: this.countdownTimer ? 
                Math.max(0, COUNTDOWN_MS - (Date.now() - this.countdownStartedAt)) : null
        };
    }
}

module.exports = { SitNGoQueue };

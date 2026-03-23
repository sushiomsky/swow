/**
 * EngineController.js
 * 
 * Global engine singleton for automation, testing, and programmatic control.
 * Decouples game engine from UI, making it accessible via window.engine and window.swowDebug.
 * 
 * Goals:
 * - Engine initializes automatically on page load
 * - No user interaction required
 * - Fully automatable (Playwright, bots, AI players)
 * - State introspection for testing
 * - Support autoplay mode via URL params
 */

class EngineController {
    constructor() {
        this.state = 'loading';  // loading | menu | playing | gameover
        this.mode = null;        // 'sp' | 'mp' | null
        this.roomCode = null;
        this.playerId = null;
        this.playerNum = null;
        
        this._spModule = null;
        this._mpModule = null;
        this._spApp = null;
        this._mpApp = null;
        this._engine = null;
        
        this._initPromise = null;
        this._listeners = {};
        
        // Auto-initialize
        this._autoInit();
    }
    
    async _autoInit() {
        if (this._initPromise) return this._initPromise;
        
        this._initPromise = (async () => {
            try {
                // Pre-load SP module (lightweight, for attract mode)
                this._spModule = await import('../game/singleplayer/App.js');
                this.state = 'menu';
                this._emit('ready');
            } catch (err) {
                console.error('[EngineController] Failed to initialize:', err);
                this.state = 'error';
            }
        })();
        
        return this._initPromise;
    }
    
    // ─── Lifecycle Methods ────────────────────────────────────────────
    
    async startNewGame(numPlayers = 1) {
        await this._initPromise;
        
        try {
            // Tear down existing mode
            await this._teardown();
            
            // Initialize SP mode
            this.mode = 'sp';
            this.state = 'loading';
            
            // Let UI create DOM (if play.js is loaded)
            this._emit('startSP', { numPlayers });
            
            // Wait for UI to be ready (or timeout after 2s)
            await this._waitForSPReady();
            
            // Start game
            if (this._engine && this._engine.startNewGame) {
                this._engine.startNewGame(numPlayers);
                this.state = 'playing';
                this._emit('playing');
            }
            
            return this.getState();
        } catch (err) {
            console.error('[EngineController] Failed to start game:', err);
            this.state = 'error';
            return this.getState();
        }
    }
    
    async createRoom() {
        await this._initPromise;
        
        try {
            // Tear down existing mode
            await this._teardown();
            
            // Initialize MP mode
            this.mode = 'mp';
            this.state = 'loading';
            
            // Load MP module
            if (!this._mpModule) {
                this._mpModule = await import('../game/multiplayer/client/MultiplayerApp.js');
            }
            
            // Let UI create DOM (if play.js is loaded)
            this._emit('startMP', { roomCode: null });
            
            // Wait for room creation
            await this._waitForMPReady();
            
            this.state = 'playing';
            this._emit('playing');
            
            return this.getState();
        } catch (err) {
            console.error('[EngineController] Failed to create room:', err);
            this.state = 'error';
            return this.getState();
        }
    }
    
    async joinRoom(code) {
        await this._initPromise;
        
        try {
            // Tear down existing mode
            await this._teardown();
            
            // Initialize MP mode
            this.mode = 'mp';
            this.state = 'loading';
            this.roomCode = code;
            
            // Load MP module
            if (!this._mpModule) {
                this._mpModule = await import('../game/multiplayer/client/MultiplayerApp.js');
            }
            
            // Let UI create DOM (if play.js is loaded)
            this._emit('startMP', { roomCode: code });
            
            // Wait for connection
            await this._waitForMPReady();
            
            this.state = 'playing';
            this._emit('playing');
            
            return this.getState();
        } catch (err) {
            console.error('[EngineController] Failed to join room:', err);
            this.state = 'error';
            return this.getState();
        }
    }
    
    async reset() {
        await this._teardown();
        this.state = 'menu';
        this.mode = null;
        this.roomCode = null;
        this.playerId = null;
        this.playerNum = null;
        this._emit('reset');
        return this.getState();
    }
    
    // ─── State Introspection ──────────────────────────────────────────
    
    getState() {
        const base = {
            state: this.state,
            mode: this.mode,
            isMultiplayer: this.mode === 'mp',
            roomCode: this.roomCode,
            playerId: this.playerId,
            playerNum: this.playerNum,
            tick: 0,
            scene: null,
            players: [],
            startedAt: null,
            gameOverAt: null,
        };
        
        // Try to get detailed state from active engine
        if (this.mode === 'sp' && this._engine) {
            try {
                const scene = this._engine.getCurrentScene?.() || null;
                base.scene = scene?.name || scene?.constructor?.name || null;
                base.tick = this._engine.tickCount || 0;
                
                // Try to get player data
                if (this._engine.player) {
                    base.players.push({
                        score: this._engine.player.score || 0,
                        lives: this._engine.player.lives || 0,
                        status: this._engine.player.status || 'unknown',
                    });
                }
            } catch (err) {
                // Ignore errors in state extraction
            }
        }
        
        if (this.mode === 'mp' && this._mpApp) {
            try {
                // Try to get MP state
                if (this._mpApp.session) {
                    base.playerId = this._mpApp.session.playerId;
                    base.playerNum = this._mpApp.session.playerNum;
                }
                
                // Try to get last state from message controller
                if (this._mpApp.messageEffectsController?._lastState) {
                    const mpState = this._mpApp.messageEffectsController._lastState;
                    base.scene = mpState.scene;
                    base.players = mpState.players || [];
                }
            } catch (err) {
                // Ignore errors
            }
        }
        
        return base;
    }
    
    // ─── Event System ─────────────────────────────────────────────────
    
    on(event, handler) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(handler);
    }
    
    off(event, handler) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(h => h !== handler);
    }
    
    _emit(event, data) {
        if (!this._listeners[event]) return;
        this._listeners[event].forEach(handler => {
            try {
                handler(data);
            } catch (err) {
                console.error(`[EngineController] Event handler error (${event}):`, err);
            }
        });
    }
    
    // ─── Internal Helpers ─────────────────────────────────────────────
    
    async _teardown() {
        if (this.mode === 'sp') {
            try {
                this._spModule?.destroySingleplayer?.();
            } catch (_) { /* ok */ }
            this._spApp = null;
            this._engine = null;
        }
        
        if (this.mode === 'mp') {
            try {
                this._mpModule?.destroyMultiplayer?.();
            } catch (_) { /* ok */ }
            this._mpApp = null;
        }
        
        this._emit('teardown');
    }
    
    async _waitForSPReady() {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(), 2000); // 2s timeout
            
            const check = setInterval(() => {
                if (this._spApp && this._engine) {
                    clearInterval(check);
                    clearTimeout(timeout);
                    resolve();
                }
            }, 50);
        });
    }
    
    async _waitForMPReady() {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(), 5000); // 5s timeout for WebSocket
            
            const check = setInterval(() => {
                if (this._mpApp) {
                    clearInterval(check);
                    clearTimeout(timeout);
                    resolve();
                }
            }, 50);
        });
    }
    
    // ─── Internal Setters (called by play.js) ────────────────────────
    
    _setSPApp(app, engine) {
        this._spApp = app;
        this._engine = engine;
    }
    
    _setMPApp(app) {
        this._mpApp = app;
        if (app && app.session) {
            this.playerId = app.session.playerId;
            this.playerNum = app.session.playerNum;
        }
    }
    
    _setRoomCode(code) {
        this.roomCode = code;
    }
}

// ─── Singleton Export ─────────────────────────────────────────────────

const engineController = new EngineController();

// Expose as window.engine
if (typeof window !== 'undefined') {
    window.engine = engineController;
}

// ─── Debug API ────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    window.swowDebug = {
        start: async (numPlayers = 1) => {
            try {
                return await window.engine.startNewGame(numPlayers);
            } catch (err) {
                console.error('[swowDebug] start() failed:', err);
                return window.engine.getState();
            }
        },
        
        createRoom: async () => {
            try {
                return await window.engine.createRoom();
            } catch (err) {
                console.error('[swowDebug] createRoom() failed:', err);
                return window.engine.getState();
            }
        },
        
        join: async (code) => {
            try {
                return await window.engine.joinRoom(code);
            } catch (err) {
                console.error('[swowDebug] join() failed:', err);
                return window.engine.getState();
            }
        },
        
        reset: async () => {
            try {
                return await window.engine.reset();
            } catch (err) {
                console.error('[swowDebug] reset() failed:', err);
                return window.engine.getState();
            }
        },
        
        getState: () => {
            try {
                return window.engine.getState();
            } catch (err) {
                console.error('[swowDebug] getState() failed:', err);
                return { state: 'error', error: err.message };
            }
        },
        
        isReady: () => {
            try {
                return window.engine.state !== 'loading';
            } catch (err) {
                return false;
            }
        },
        
        waitReady: (timeout = 5000) => {
            return new Promise((resolve, reject) => {
                const start = Date.now();
                const check = setInterval(() => {
                    if (window.swowDebug.isReady()) {
                        clearInterval(check);
                        resolve();
                    } else if (Date.now() - start > timeout) {
                        clearInterval(check);
                        reject(new Error('Timeout waiting for engine ready'));
                    }
                }, 50);
            });
        },
    };
}

export default engineController;

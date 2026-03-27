/**
 * BackgroundGameView — Live game spectator for landing page background
 * 
 * Features:
 * - Finds an active dungeon to spectate
 * - Connects as spectator via WebSocket
 * - Renders game state in background canvas
 * - Low opacity + blur for ambient effect
 * - Auto-switches if dungeon ends
 */

export class BackgroundGameView {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('[BackgroundGameView] Canvas not found:', canvasId);
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.ws = null;
        this.connected = false;
        this.dungeonId = null;
        this.state = null;
        this.reconnectTimer = null;
        
        this.setupCanvas();
    }
    
    setupCanvas() {
        // Match viewport size
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Resize on window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
    }
    
    async init() {
        console.log('[BackgroundGameView] Initializing background game');
        await this.findAndConnectToGame();
    }
    
    async findAndConnectToGame() {
        try {
            // Fetch active dungeons
            const response = await fetch('/multiplayer/dungeon-topology');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const topology = await response.json();
            
            if (!topology.dungeons || topology.dungeons.length === 0) {
                console.log('[BackgroundGameView] No active dungeons, retrying in 10s');
                this.scheduleReconnect(10000);
                return;
            }
            
            // Pick a random active dungeon
            const activeDungeons = topology.dungeons.filter(d => 
                d.lifecycle_state === 'active' && d.player_count > 0
            );
            
            if (activeDungeons.length === 0) {
                console.log('[BackgroundGameView] No active dungeons with players, retrying in 10s');
                this.scheduleReconnect(10000);
                return;
            }
            
            const randomDungeon = activeDungeons[Math.floor(Math.random() * activeDungeons.length)];
            this.dungeonId = randomDungeon.id;
            
            console.log('[BackgroundGameView] Selected dungeon:', this.dungeonId);
            this.connect();
            
        } catch (err) {
            console.error('[BackgroundGameView] Failed to find game:', err);
            this.scheduleReconnect(10000);
        }
    }
    
    connect() {
        if (!this.dungeonId) return;
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/multiplayer`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => this.onOpen();
        this.ws.onmessage = (event) => this.onMessage(event);
        this.ws.onclose = () => this.onClose();
        this.ws.onerror = () => this.onError();
    }
    
    onOpen() {
        console.log('[BackgroundGameView] Connected, requesting spectate for dungeon:', this.dungeonId);
        this.ws.send(JSON.stringify({
            type: 'spectate',
            dungeonId: this.dungeonId
        }));
    }
    
    onMessage(event) {
        try {
            const msg = JSON.parse(event.data);
            
            switch (msg.type) {
                case 'spectate_init':
                    this.onSpectateInit(msg);
                    break;
                    
                case 'spectate_state':
                    this.onSpectateState(msg);
                    break;
                    
                case 'spectate_error':
                    console.error('[BackgroundGameView] Spectate error:', msg.message);
                    this.disconnect();
                    this.scheduleReconnect(5000);
                    break;
            }
        } catch (err) {
            console.error('[BackgroundGameView] Parse error:', err);
        }
    }
    
    onSpectateInit(msg) {
        console.log('[BackgroundGameView] Spectate init');
        this.connected = true;
        this.state = msg.state;
        this.render();
    }
    
    onSpectateState(msg) {
        this.state = msg.state;
        this.render();
        
        // Check if dungeon is ending
        if (this.state && this.state.lifecycleState === 'empty') {
            console.log('[BackgroundGameView] Dungeon ended, switching to another');
            this.disconnect();
            this.scheduleReconnect(2000);
        }
    }
    
    onClose() {
        console.log('[BackgroundGameView] Disconnected');
        this.connected = false;
        this.scheduleReconnect(5000);
    }
    
    onError() {
        console.error('[BackgroundGameView] WebSocket error');
        this.disconnect();
        this.scheduleReconnect(5000);
    }
    
    scheduleReconnect(delay) {
        if (this.reconnectTimer) return;
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.findAndConnectToGame();
        }, delay);
    }
    
    render() {
        if (!this.state) return;
        
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw simple placeholder visualization
        // (Full game rendering would require importing the game renderer)
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Draw title
        this.ctx.fillStyle = '#2277ee';
        this.ctx.font = 'bold 32px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`DUNGEON ${this.dungeonId}`, centerX, 60);
        
        // Draw player indicators
        if (this.state.players && this.state.players.length > 0) {
            this.ctx.font = '16px monospace';
            this.ctx.fillStyle = '#0ff';
            
            this.state.players.forEach((player, i) => {
                const y = 100 + i * 30;
                const status = player.status === 'alive' ? '●' : '○';
                const text = `${status} P${i + 1}  Score: ${player.score || 0}  Lives: ${player.lives || 0}`;
                this.ctx.fillText(text, centerX, y);
            });
        }
        
        // Draw monsters count
        if (this.state.monsters) {
            this.ctx.fillStyle = '#f60';
            this.ctx.font = '20px monospace';
            this.ctx.fillText(`Monsters: ${this.state.monsters.length}`, centerX, centerY);
        }
        
        // Draw level
        if (this.state.level !== undefined) {
            this.ctx.fillStyle = '#8f8';
            this.ctx.font = '18px monospace';
            this.ctx.fillText(`Level ${this.state.level}`, centerX, centerY + 40);
        }
        
        // NOTE: Full rendering would require porting the game renderer
        // For MVP, this placeholder provides visual feedback
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
    }
    
    destroy() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.disconnect();
    }
}

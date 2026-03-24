/**
 * SpectatorClient — Read-only WebSocket client for watching live games
 * 
 * Features:
 * - Connects to multiplayer server with 'spectate' message
 * - Receives dungeon state at 2 FPS (500ms intervals)
 * - Renders game view in canvas (read-only, no input)
 * - Handles reconnection on disconnect
 */

export class SpectatorClient {
    constructor(dungeonId) {
        this.dungeonId = dungeonId;
        this.ws = null;
        this.connected = false;
        this.state = null;
        this.canvas = null;
        this.ctx = null;
        
        // UI elements
        this.overlay = document.getElementById('spectator-overlay');
        this.message = document.getElementById('overlay-message');
        this.info = document.getElementById('dungeon-info');
        
        this.setupCanvas();
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('spectator-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size (match game dimensions)
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        // Scale canvas to fit screen while maintaining aspect ratio
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const container = document.getElementById('spectator-container');
        const headerHeight = 50; // Approximate header height
        const availableWidth = window.innerWidth;
        const availableHeight = window.innerHeight - headerHeight;
        
        const scaleX = availableWidth / this.canvas.width;
        const scaleY = availableHeight / this.canvas.height;
        const scale = Math.min(scaleX, scaleY);
        
        this.canvas.style.width = `${this.canvas.width * scale}px`;
        this.canvas.style.height = `${this.canvas.height * scale}px`;
    }
    
    connect() {
        console.log('[SpectatorClient] Connecting to dungeon:', this.dungeonId);
        this.showMessage('Connecting to game...');
        
        // Determine WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => this.onOpen();
        this.ws.onmessage = (event) => this.onMessage(event);
        this.ws.onclose = () => this.onClose();
        this.ws.onerror = (error) => this.onError(error);
    }
    
    onOpen() {
        console.log('[SpectatorClient] Connected, requesting spectate');
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
                    this.showError(msg.message || 'Failed to spectate game');
                    break;
                    
                default:
                    console.log('[SpectatorClient] Unknown message:', msg.type);
            }
        } catch (err) {
            console.error('[SpectatorClient] Parse error:', err);
        }
    }
    
    onSpectateInit(msg) {
        console.log('[SpectatorClient] Spectate init:', msg);
        this.connected = true;
        this.state = msg.state;
        this.hideOverlay();
        this.updateInfo();
        this.render();
    }
    
    onSpectateState(msg) {
        this.state = msg.state;
        this.updateInfo();
        this.render();
    }
    
    onClose() {
        console.log('[SpectatorClient] Disconnected');
        this.connected = false;
        this.showMessage('Disconnected. Reconnecting...');
        
        // Attempt reconnection after 3 seconds
        setTimeout(() => this.connect(), 3000);
    }
    
    onError(error) {
        console.error('[SpectatorClient] WebSocket error:', error);
        this.showError('Connection error. Retrying...');
    }
    
    updateInfo() {
        if (!this.state) return;
        
        const playerCount = this.state.players?.length || 0;
        const level = this.state.level || 0;
        this.info.textContent = `Dungeon ${this.dungeonId} • ${playerCount} players • Level ${level}`;
    }
    
    render() {
        if (!this.state) return;
        
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render placeholder (will be replaced with actual game rendering)
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SPECTATOR MODE', this.canvas.width / 2, 50);
        this.ctx.font = '14px monospace';
        this.ctx.fillText(`Dungeon ${this.dungeonId}`, this.canvas.width / 2, 80);
        
        // Render basic state info
        if (this.state.players) {
            let y = 120;
            this.ctx.fillText(`Players: ${this.state.players.length}`, this.canvas.width / 2, y);
            y += 30;
            
            this.state.players.forEach((player, i) => {
                const text = `P${i + 1}: Score ${player.score || 0} | Lives ${player.lives || 3}`;
                this.ctx.fillText(text, this.canvas.width / 2, y);
                y += 25;
            });
        }
        
        if (this.state.monsters) {
            const y = 240;
            this.ctx.fillText(`Monsters: ${this.state.monsters.length}`, this.canvas.width / 2, y);
        }
        
        // NOTE: Full rendering would require importing GameRenderer
        // For MVP, this placeholder is sufficient
    }
    
    showMessage(text) {
        this.message.textContent = text;
        this.overlay.classList.remove('hidden');
    }
    
    showError(text) {
        this.message.textContent = `❌ ${text}`;
        this.overlay.classList.remove('hidden');
    }
    
    hideOverlay() {
        this.overlay.classList.add('hidden');
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

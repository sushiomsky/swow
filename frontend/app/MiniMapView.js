/**
 * MiniMapView — Miniaturized overview of all connected dungeons
 * 
 * Features:
 * - Displays all dungeons in ring topology
 * - Shows player count, level, and state
 * - Real-time updates via polling
 * - Click dungeon to spectate
 * - Visual connections between dungeons
 */

export class MiniMapView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('[MiniMapView] Container not found:', containerId);
            return;
        }
        
        this.topology = null;
        this.pollInterval = null;
        this.updateRate = 3000; // 3 seconds
    }
    
    async init() {
        console.log('[MiniMapView] Initializing mini-map');
        await this.fetchTopology();
        this.render();
        this.startPolling();
    }
    
    async fetchTopology() {
        try {
            const response = await fetch('/multiplayer/dungeon-topology');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            this.topology = await response.json();
        } catch (err) {
            console.error('[MiniMapView] Failed to fetch topology:', err);
            this.topology = { dungeons: [], total_dungeons: 0, topology: 'independent' };
        }
    }
    
    startPolling() {
        if (this.pollInterval) return;
        
        this.pollInterval = setInterval(() => {
            this.fetchTopology().then(() => this.render());
        }, this.updateRate);
        
        console.log(`[MiniMapView] Polling started at ${this.updateRate}ms`);
    }
    
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
            console.log('[MiniMapView] Polling stopped');
        }
    }
    
    render() {
        if (!this.topology || !this.topology.dungeons.length) {
            this.renderEmpty();
            return;
        }
        
        let html = '<div class="minimap-header">';
        html += '<span class="minimap-title">🗺 DUNGEON MAP</span>';
        html += `<span class="minimap-count">${this.topology.total_dungeons} dungeons</span>`;
        html += '</div>';
        
        html += '<div class="minimap-grid">';
        
        // Render dungeons in a circular layout
        const dungeons = this.topology.dungeons;
        dungeons.forEach((dungeon, index) => {
            html += this.renderDungeonCard(dungeon, index, dungeons.length);
        });
        
        html += '</div>';
        
        this.container.innerHTML = html;
        this.attachEventListeners();
    }
    
    renderEmpty() {
        this.container.innerHTML = `
            <div class="minimap-empty">
                <div class="empty-icon">🗺</div>
                <div class="empty-text">No active dungeons</div>
            </div>
        `;
    }
    
    renderDungeonCard(dungeon, index, total) {
        const stateClass = this.getStateClass(dungeon.lifecycle_state);
        const stateLabel = this.getStateLabel(dungeon.lifecycle_state);
        const playerCount = dungeon.player_count || 0;
        
        let html = `<div class="minimap-dungeon ${stateClass}" data-dungeon-id="${dungeon.id}">`;
        
        // Header
        html += '<div class="dungeon-header">';
        html += `<span class="dungeon-id">D${dungeon.id}</span>`;
        html += `<span class="dungeon-state">${stateLabel}</span>`;
        html += '</div>';
        
        // Stats
        html += '<div class="dungeon-stats">';
        html += `<div class="stat-row">`;
        html += `<span class="stat-icon">👥</span>`;
        html += `<span class="stat-value">${playerCount}</span>`;
        html += `</div>`;
        html += `<div class="stat-row">`;
        html += `<span class="stat-icon">📊</span>`;
        html += `<span class="stat-value">Lvl ${dungeon.level || 0}</span>`;
        html += `</div>`;
        html += '</div>';
        
        // Players
        if (dungeon.players && dungeon.players.length > 0) {
            html += '<div class="dungeon-players">';
            dungeon.players.forEach(player => {
                const status = player.status === 'alive' ? '✓' : '✗';
                html += `<div class="player-mini" title="Score: ${player.score}">`;
                html += `${status} ${player.lives || 0}♥`;
                html += `</div>`;
            });
            html += '</div>';
        }
        
        // Connections
        html += '<div class="dungeon-connections">';
        if (dungeon.connections.left) {
            html += `<span class="conn-left" title="Connected to D${dungeon.connections.left}">←</span>`;
        }
        if (dungeon.connections.right) {
            html += `<span class="conn-right" title="Connected to D${dungeon.connections.right}">→</span>`;
        }
        html += '</div>';
        
        // Spectate button
        html += `<button class="minimap-spectate-btn" data-dungeon-id="${dungeon.id}">👁</button>`;
        
        html += '</div>';
        
        return html;
    }
    
    getStateClass(lifecycleState) {
        switch (lifecycleState) {
            case 'active': return 'state-active';
            case 'collapsing': return 'state-collapsing';
            case 'empty': return 'state-empty';
            default: return '';
        }
    }
    
    getStateLabel(lifecycleState) {
        switch (lifecycleState) {
            case 'active': return 'ACTIVE';
            case 'collapsing': return 'COLLAPSE';
            case 'empty': return 'EMPTY';
            default: return 'UNKNOWN';
        }
    }
    
    attachEventListeners() {
        const spectateButtons = this.container.querySelectorAll('.minimap-spectate-btn');
        spectateButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dungeonId = e.target.getAttribute('data-dungeon-id');
                this.handleSpectate(dungeonId);
            });
        });
        
        // Click dungeon card to spectate
        const dungeonCards = this.container.querySelectorAll('.minimap-dungeon');
        dungeonCards.forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('minimap-spectate-btn')) return;
                const dungeonId = card.getAttribute('data-dungeon-id');
                this.handleSpectate(dungeonId);
            });
        });
    }
    
    handleSpectate(dungeonId) {
        console.log('[MiniMapView] Spectating dungeon:', dungeonId);
        window.location.href = `/spectate?dungeon=${dungeonId}`;
    }
    
    destroy() {
        this.stopPolling();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

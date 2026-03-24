/**
 * ActiveGamesList.js
 * 
 * Displays a live feed of active Battle Royale games.
 * Polls /multiplayer/active-games API every 5 seconds.
 */

export class ActiveGamesList {
    constructor(containerEl) {
        this.container = containerEl;
        this.games = [];
        this.totalPlayers = 0;
        this.pollInterval = null;
        this.updateInterval = 5000; // 5 seconds
    }
    
    async init() {
        await this.fetchGames();
        this.render();
        this.startPolling();
    }
    
    async fetchGames() {
        try {
            const response = await fetch('/multiplayer/active-games');
            const data = await response.json();
            this.games = data.games || [];
            this.totalPlayers = data.total_players || 0;
        } catch (err) {
            console.error('[ActiveGamesList] Failed to fetch games:', err);
            this.games = [];
            this.totalPlayers = 0;
        }
    }
    
    startPolling() {
        this.pollInterval = setInterval(async () => {
            await this.fetchGames();
            this.render();
        }, this.updateInterval);
    }
    
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    
    destroy() {
        this.stopPolling();
        this.container.innerHTML = '';
    }
    
    render() {
        if (!this.container) return;
        
        const hasGames = this.games.length > 0;
        
        let html = '<div class="active-games-panel">';
        
        // Header
        html += '<div class="active-games-header">';
        html += '<div class="active-games-title">🎮 ACTIVE GAMES</div>';
        if (hasGames) {
            html += `<div class="active-games-count">${this.games.length} games • ${this.totalPlayers} players</div>`;
        }
        html += '</div>';
        
        // Games list or empty state
        if (hasGames) {
            html += '<div class="active-games-list">';
            this.games.forEach(game => {
                html += this.renderGameCard(game);
            });
            html += '</div>';
        } else {
            html += '<div class="active-games-empty">';
            html += '<div class="empty-icon">⚔</div>';
            html += '<div class="empty-text">No active games</div>';
            html += '<div class="empty-hint">Be the first to start a Battle Royale!</div>';
            html += '</div>';
        }
        
        html += '</div>';
        
        this.container.innerHTML = html;
        
        // Wire up event listeners
        if (hasGames) {
            this.attachEventListeners();
        }
    }
    
    renderGameCard(game) {
        const modeLabel = this.getModeLabel(game.mode);
        const modeIcon = this.getModeIcon(game.mode);
        const playerCount = game.players?.length || game.player_count || 0;
        const dungeonCount = game.dungeons || 1;
        const duration = this.formatDuration(game.created_at);
        
        let html = '<div class="game-card">';
        html += `<div class="game-mode">${modeIcon} ${modeLabel}</div>`;
        html += '<div class="game-stats">';
        html += `<span class="stat">${playerCount} players</span>`;
        html += `<span class="stat-sep">•</span>`;
        html += `<span class="stat">${dungeonCount} dungeons</span>`;
        if (duration) {
            html += `<span class="stat-sep">•</span>`;
            html += `<span class="stat">${duration}</span>`;
        }
        html += '</div>';
        
        // Action buttons
        html += '<div class="game-actions">';
        
        // SPECTATE button (always show for active games)
        if (game.dungeon_id) {
            html += `<button class="game-btn spectate-btn" data-dungeon-id="${game.dungeon_id}">👁 SPECTATE</button>`;
        }
        
        // JOIN button (if joinable)
        if (game.joinable !== false && game.mode) {
            html += `<button class="game-btn join-btn" data-mode="${game.mode}">JOIN</button>`;
        }
        
        html += '</div>';
        html += '</div>';
        
        return html;
    }
    
    getModeLabel(mode) {
        const labels = {
            'endless': 'ENDLESS BR',
            'sitngo': 'SIT-N-GO BR',
            'team': 'TEAM BR',
            'team-endless': 'TEAM ENDLESS',
            'team-sitngo': 'TEAM SIT-N-GO'
        };
        return labels[mode] || mode.toUpperCase();
    }
    
    getModeIcon(mode) {
        const icons = {
            'endless': '⚔',
            'sitngo': '⏱',
            'team': '🛡',
            'team-endless': '🛡',
            'team-sitngo': '🛡'
        };
        return icons[mode] || '🎮';
    }
    
    formatDuration(createdAt) {
        if (!createdAt) return 'just now';
        
        const now = new Date();
        const created = new Date(createdAt);
        const diffMs = now - created;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'just now';
        if (diffMins === 1) return '1 min';
        if (diffMins < 60) return `${diffMins} mins`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours === 1) return '1 hour';
        return `${diffHours} hours`;
    }
    
    attachEventListeners() {
        // Join buttons
        const joinButtons = this.container.querySelectorAll('.join-btn');
        joinButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.getAttribute('data-mode');
                this.handleJoinGame(mode);
            });
        });
        
        // Spectate buttons
        const spectateButtons = this.container.querySelectorAll('.spectate-btn');
        spectateButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dungeonId = e.target.getAttribute('data-dungeon-id');
                this.handleSpectateGame(dungeonId);
            });
        });
    }
    
    handleSpectateGame(dungeonId) {
        console.log('[ActiveGamesList] Spectating dungeon:', dungeonId);
        window.location.href = `/spectate?dungeon=${dungeonId}`;
    }
    
    handleJoinGame(mode) {
        // Redirect to multiplayer page with mode
        window.location.href = `/mp?mode=${mode}`;
    }
}

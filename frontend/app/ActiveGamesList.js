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
        // Render loading state immediately (shows placeholder buttons)
        this.renderLoading();
        
        // Fetch games in the background
        await this.fetchGames();
        
        // Render actual games or empty state
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
    
    renderLoading() {
        if (!this.container) return;
        
        let html = '<div class="active-games-panel">';
        html += '<div class="active-games-header">';
        html += '<div class="active-games-title">🎮 LAUFENDE SPIELE</div>';
        html += '<div class="active-games-count loading-pulse">Lädt…</div>';
        html += '</div>';
        html += '<div class="active-games-list loading-state">';
        
        // Render 3 placeholder game cards with skeleton buttons
        for (let i = 1; i <= 3; i++) {
            html += '<div class="game-card loading-card">';
            html += '<div class="game-mode loading-pulse">ENDLOS-BR</div>';
            html += '<div class="game-stats">';
            html += '<span class="stat loading-pulse">2 Spieler</span>';
            html += '<span class="stat-sep">•</span>';
            html += '<span class="stat loading-pulse">1 Dungeon</span>';
            html += '</div>';
            html += '<div class="game-actions">';
            html += `<button class="game-btn spectate-btn loading-pulse" data-dungeon-id="placeholder-${i}">👁 ZUSCHAUEN</button>`;
            html += `<button class="game-btn join-btn loading-pulse" data-mode="endless">MITMACHEN</button>`;
            html += '</div>';
            html += '</div>';
        }
        
        html += '</div>';
        html += '</div>';
        
        this.container.innerHTML = html;
    }
    
    render() {
        if (!this.container) return;
        
        const hasGames = this.games.length > 0;
        
        let html = '<div class="active-games-panel">';
        
        // Header
        html += '<div class="active-games-header">';
        html += '<div class="active-games-title">🎮 LAUFENDE SPIELE</div>';
        if (hasGames) {
            const gameWord = this.games.length === 1 ? 'Spiel' : 'Spiele';
            const playerWord = this.totalPlayers === 1 ? 'Spieler' : 'Spieler';
            html += `<div class="active-games-count">${this.games.length} ${gameWord} • ${this.totalPlayers} ${playerWord}</div>`;
            html += '<a href="/minimap" class="minimap-link" title="Alle Dungeons ansehen">🗺</a>';
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
            html += '<div class="empty-text">Keine laufenden Spiele</div>';
            html += '<div class="empty-hint">Sei der Erste — starte ein Battle Royale!</div>';
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
        html += `<span class="stat">${playerCount} Spieler</span>`;
        html += `<span class="stat-sep">•</span>`;
        html += `<span class="stat">${dungeonCount} Dungeon${dungeonCount === 1 ? '' : 's'}</span>`;
        if (duration) {
            html += `<span class="stat-sep">•</span>`;
            html += `<span class="stat stat-time">${duration}</span>`;
        }
        html += '</div>';
        
        // Action buttons
        html += '<div class="game-actions">';
        
        // ZUSCHAUEN-Button (immer bei laufenden Spielen anzeigen)
        if (game.dungeon_id) {
            html += `<button class="game-btn spectate-btn" data-dungeon-id="${game.dungeon_id}">👁 ZUSCHAUEN</button>`;
        }

        // MITMACHEN-Button (wenn beitretbar)
        if (game.joinable !== false && game.mode) {
            html += `<button class="game-btn join-btn" data-mode="${game.mode}">MITMACHEN</button>`;
        }
        
        html += '</div>';
        html += '</div>';
        
        return html;
    }
    
    getModeLabel(mode) {
        const labels = {
            'endless': 'ENDLOS-BR',
            'sitngo': 'RUNDEN-BR',
            'team': 'TEAM-BR',
            'team-endless': 'TEAM-ENDLOS',
            'team-sitngo': 'TEAM-RUNDEN'
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
        if (!createdAt) return 'gerade eben';

        const now = new Date();
        const created = new Date(createdAt);
        const diffMs = now - created;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'gerade eben';
        if (diffMins === 1) return 'vor 1 Min.';
        if (diffMins < 60) return `vor ${diffMins} Min.`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours === 1) return 'vor 1 Std.';
        return `vor ${diffHours} Std.`;
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

export class MultiplayerMessageEffectsController {
    constructor({
        session,
        uiController,
        audio,
        options,
        getLastJoinType,
        setIsConnecting,
        setHasJoinedGame,
        setLastState,
        onCopyPrivateLink,
    }) {
        this.session = session;
        this.uiController = uiController;
        this.audio = audio;
        this.options = options;
        this.getLastJoinType = getLastJoinType;
        this.setIsConnecting = setIsConnecting;
        this.setHasJoinedGame = setHasJoinedGame;
        this.setLastState = setLastState;
        this.onCopyPrivateLink = onCopyPrivateLink;
    }

    handleConnected(msg) {
        this.session.playerId = msg.playerId;
    }

    handleWaitingForPartner() {
        this.uiController.setStatus('Waiting for second player to join…');
    }

    handleWaitingForSitNGo(msg) {
        this.uiController.setStatus(`Sit-n-Go queue: ${msg.queued}/${msg.minPlayers} players. Waiting…`);
    }

    handlePrivatePairCreated(msg) {
        const code = msg.code || '';
        const rawJoinUrl = msg?.joinUrl || `/?room=${encodeURIComponent(code)}`;
        const absoluteUrl = rawJoinUrl.startsWith('http') ? rawJoinUrl : `${location.origin}${rawJoinUrl}`;
        const shareText = `Join my Wizard of Wor game! ${absoluteUrl}`;
        const twitterUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText);

        // Build prominent share panel
        let panel = document.getElementById('mp-share-panel');
        if (panel) panel.remove();
        panel = document.createElement('div');
        panel.id = 'mp-share-panel';
        panel.innerHTML = `
            <div class="mp-share-code">${code}</div>
            <div class="mp-share-label">Share this code or link with a friend</div>
            <div class="mp-share-buttons">
                <button class="share-btn share-copy" id="mp-copy-link">📋 COPY LINK</button>
                <a class="share-btn share-twitter" href="${twitterUrl}" target="_blank" rel="noopener">𝕏 SHARE</a>
            </div>
            <div class="mp-share-waiting">Waiting for player 2…</div>
        `;
        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.after(panel);

        document.getElementById('mp-copy-link')?.addEventListener('click', () => {
            navigator.clipboard?.writeText(absoluteUrl).then(() => {
                const btn = document.getElementById('mp-copy-link');
                if (btn) btn.textContent = '✓ COPIED';
            });
        });

        this.uiController.setStatus('');
        this.onCopyPrivateLink(msg);
    }

    handleJoinError(msg) {
        this.uiController.setStatus(msg.message || 'Unable to join this mode.');
        this.uiController.setStatusError(true);
        this.uiController.setButtonState(false);
        this.uiController.toggleRetry(!!this.getLastJoinType());
        if (typeof this.setIsConnecting === 'function') this.setIsConnecting(false);
    }

    handleInit(msg) {
        if (typeof this.setIsConnecting === 'function') this.setIsConnecting(false);
        if (typeof this.setHasJoinedGame === 'function') this.setHasJoinedGame(true);
        this.uiController.setButtonState(false);
        this.uiController.toggleRetry(false);
        this.session.playerId = msg.playerId;
        this.session.playerNum = msg.playerNum;
        this.session.dungeonId = msg.dungeonId;
        this.session.homeDungeonId = msg.homeDungeonId;
        this.uiController.hideOverlay();
        this.uiController.showGameSurface();
        this.uiController.setStatus('');
        this.uiController.setStatusError(false);
        this.uiController.setHudDungeonText(this._buildHudText(msg));
        this.audio.resumeContext();
    }

    handleState(msg) {
        this.setLastState(msg.state);
        this.session.dungeonId = msg.state.dungeonId;
        this.audio.processSounds(msg.state.sounds, this.options.sound === 'on');
    }

    _buildHudText(msg) {
        const teamText = msg.team ? ` | Team: ${msg.team.toUpperCase()}` : '';
        const modeText = msg.mode ? ` | Mode: ${msg.mode.replaceAll('_', ' ').toUpperCase()}` : '';
        const playerColor = this.session.playerNum === 0 ? '🟡 Yellow' : '🔵 Blue';
        return `Dungeon ${this.session.dungeonId} | You: ${playerColor}${teamText}${modeText}`;
    }
}

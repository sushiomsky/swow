export class MultiplayerMessageEffectsController {
    constructor({
        session,
        uiController,
        audio,
        options,
        setIsConnecting,
        setHasJoinedGame,
        setLastState,
        onCopyPrivateLink,
    }) {
        this.session = session;
        this.uiController = uiController;
        this.audio = audio;
        this.options = options;
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

    handlePrivatePairCreated(msg) {
        const code = msg.code || '';
        const rawJoinUrl = msg?.joinUrl || `/?room=${encodeURIComponent(code)}`;
        const absoluteUrl = rawJoinUrl.startsWith('http') ? rawJoinUrl : `${location.origin}${rawJoinUrl}`;
        const shareText = `Join my Wizard of Wor game! ${absoluteUrl}`;
        const twitterUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText);

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
        if (window.engine?._setRoomCode) {
            window.engine._setRoomCode(code);
        }
        this.onCopyPrivateLink(msg);
    }

    handleJoinError(msg) {
        this.uiController.setStatus(msg.message || 'Unable to join.');
        this.uiController.setStatusError(true);
        this.uiController.setButtonState(false);
        if (typeof this.setIsConnecting === 'function') this.setIsConnecting(false);
        if (window.engine?._setMultiplayerError) {
            window.engine._setMultiplayerError(msg.message || 'Unable to join.');
        }
    }

    handleInit(msg) {
        if (typeof this.setIsConnecting === 'function') this.setIsConnecting(false);
        if (typeof this.setHasJoinedGame === 'function') this.setHasJoinedGame(true);
        this.uiController.setButtonState(false);
        this.session.playerId = msg.playerId;
        this.session.playerNum = msg.playerNum;
        this.session.dungeonId = msg.dungeonId;
        this.uiController.hideOverlay();
        this.uiController.showGameSurface();
        this.uiController.setStatus('');
        this.uiController.setStatusError(false);
        const playerColor = this.session.playerNum === 0 ? '🟡 Yellow' : '🔵 Blue';
        this.uiController.setHudDungeonText(`You: ${playerColor}`);
        this.audio.resumeContext();
        if (window.engine?._setMultiplayerSession) {
            window.engine._setMultiplayerSession({
                playerId: this.session.playerId,
                playerNum: this.session.playerNum,
                dungeonId: this.session.dungeonId,
            });
        }
    }

    handleState(msg) {
        this.setLastState(msg.state);
        this.session.dungeonId = msg.state.dungeonId;
        this.audio.processSounds(msg.state.sounds, this.options.sound === 'on');
        if (window.engine?._setMultiplayerState) {
            window.engine._setMultiplayerState(msg.state);
        }

        // Detect game-over scene and dispatch event (once per game)
        if (msg.state.scene === 'gameOver' && !this._gameOverDispatched) {
            this._gameOverDispatched = true;
            const players = msg.state.players || [];
            const p0 = players[0] || { score: 0 };
            const p1 = players[1] || { score: 0 };
            const myNum = this.session.playerNum ?? 0;
            setTimeout(() => {
                document.dispatchEvent(new CustomEvent('swow:mp-game-over', {
                    detail: {
                        p1Score: p0.score,
                        p2Score: p1.score,
                        myPlayerNum: myNum,
                        myScore: players[myNum]?.score ?? 0,
                    }
                }));
            }, 2000);
        }
        // Reset flag when game restarts
        if (msg.state.scene === 'getReady' || msg.state.scene === 'dungeon') {
            this._gameOverDispatched = false;
        }
    }
    
    // ─── Battle Royale: Cross-Dungeon Events ──────────────────────────────
    
    /**
     * Handle player leaving current dungeon via tunnel
     * @param {object} msg - { playerId, targetDungeonId }
     */
    handlePlayerLeftViaTunnel(msg) {
        console.log('[Battle Royale] Player left via tunnel:', msg.playerId, '→', msg.targetDungeonId);
        
        // Show brief notification
        const notification = document.createElement('div');
        notification.className = 'tunnel-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 255, 255, 0.9);
            color: black;
            padding: 10px 20px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 14px;
            z-index: 10000;
            animation: fadeOut 3s forwards;
        `;
        notification.textContent = `Player ${msg.playerId.substr(0, 4)} entered tunnel`;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
    
    /**
     * Handle player arriving in current dungeon via tunnel
     * @param {object} msg - { playerId, playerSlot, entrySide }
     */
    handlePlayerArrivedViaTunnel(msg) {
        console.log('[Battle Royale] Player arrived via tunnel:', msg.playerId, 'at', msg.entrySide, 'entrance');
        
        // Show brief notification
        const notification = document.createElement('div');
        notification.className = 'tunnel-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 0, 0.9);
            color: black;
            padding: 10px 20px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 14px;
            z-index: 10000;
            animation: fadeOut 3s forwards;
        `;
        notification.textContent = `Player ${msg.playerId.substr(0, 4)} arrived from tunnel`;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
        
        // Optional: Play sound effect
        // this.audio.playSound('teleport');
    }
}

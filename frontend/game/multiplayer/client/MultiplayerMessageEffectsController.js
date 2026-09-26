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
        getInterpolator,
    }) {
        this.session = session;
        this.uiController = uiController;
        this.audio = audio;
        this.options = options;
        this.setIsConnecting = setIsConnecting;
        this.setHasJoinedGame = setHasJoinedGame;
        this.setLastState = setLastState;
        this.onCopyPrivateLink = onCopyPrivateLink;
        this.getInterpolator = getInterpolator;
    }

    handleConnected(msg) {
        this.session.playerId = msg.playerId;
    }

    handleWaitingForPartner() {
        this._dismissMatchStartingStatus({ clearText: false });
        this.uiController.setStatus('Waiting for more players to join… (up to 4)');
    }

    handlePrivatePairCreated(msg) {
        this._dismissMatchStartingStatus({ clearText: false });
        const code = msg.code || '';
        const maxPlayers = Number(msg?.maxPlayers) || 4;
        const rawJoinUrl = msg?.joinUrl || `/multiplayer.html?room=${encodeURIComponent(code)}`;
        const absoluteUrl = rawJoinUrl.startsWith('http') ? rawJoinUrl : `${location.origin}${rawJoinUrl}`;
        const shareText = `Join my Wizard of Wor game! ${absoluteUrl}`;
        const twitterUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText);

        let panel = document.getElementById('mp-share-panel');
        if (panel) panel.remove();
        panel = document.createElement('div');
        panel.id = 'mp-share-panel';
        panel.innerHTML = `
            <div class="mp-share-code">${code}</div>
            <div class="mp-share-label">Share this code or link with up to ${maxPlayers - 1} friends (${maxPlayers} players max)</div>
            <div class="mp-share-buttons">
                <button class="share-btn share-copy" id="mp-copy-link">📋 COPY LINK</button>
                <a class="share-btn share-twitter" href="${twitterUrl}" target="_blank" rel="noopener">𝕏 SHARE</a>
            </div>
            <div class="mp-share-waiting" id="mp-share-waiting">Waiting for players… (1/${maxPlayers})</div>
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

    // ROOM-1: live room occupancy (private_room_status).
    handlePrivateRoomStatus(msg) {
        const count = Number(msg?.playerCount) || 0;
        const max = Number(msg?.maxPlayers) || 4;
        const waitingEl = document.getElementById('mp-share-waiting');
        if (waitingEl) {
            waitingEl.textContent = count >= max
                ? `Room full — ${count}/${max} players. Fight!`
                : `Waiting for players… (${count}/${max})`;
        }
        if (count > 1) {
            this.uiController.setStatus(`Private room: ${count}/${max} players in.`);
            this.uiController.setStatusError(false);
        }
    }

    handleJoinError(msg) {
        this._dismissMatchStartingStatus({ clearText: false });
        this.uiController.setStatus(msg.message || 'Unable to join.');
        this.uiController.setStatusError(true);
        this.uiController.setButtonState(false);
        if (typeof this.setIsConnecting === 'function') this.setIsConnecting(false);
        if (window.engine?._setMultiplayerError) {
            window.engine._setMultiplayerError(msg.message || 'Unable to join.');
        }
    }

    handleInit(msg) {
        this._clearMatchStartingStatus();
        if (typeof this.setIsConnecting === 'function') this.setIsConnecting(false);
        if (typeof this.setHasJoinedGame === 'function') this.setHasJoinedGame(true);
        this.uiController.setButtonState(false);
        this.session.playerId = msg.playerId;
        this.session.playerNum = msg.playerNum;
        this.session.dungeonId = msg.dungeonId;
        this.session.matchMode = msg.matchMode || this.session.matchMode || null;
        // WIRE-1/2: prime the interpolator with the full layout from init.
        try {
            const interp = typeof this.getInterpolator === 'function' ? this.getInterpolator() : null;
            if (interp && msg.state) interp.seedFromInit(msg);
        } catch (_) { /* interpolation is best-effort */ }
        this.uiController.hideOverlay();
        this.uiController.showGameSurface();
        this.uiController.setStatus('');
        this.uiController.setStatusError(false);
        const playerColor = this._playerColorLabel(this.session.playerNum);
        const isTeamMode = typeof this.session.matchMode === 'string' && this.session.matchMode.startsWith('team_');
        if (isTeamMode) {
            // Teammates share the player's home slot colour (server: colorNum =
            // homeSlot). Slot 1 (Blue) is the opponent side, never the teammate.
            this.uiController.setHudDungeonText(`Team BR • You: ${playerColor} • Teammate: ${playerColor}`);
        } else {
            this.uiController.setHudDungeonText(`You: ${playerColor}`);
        }
        this.audio.resumeContext();
        if (window.engine?._setMultiplayerSession) {
            window.engine._setMultiplayerSession({
                playerId: this.session.playerId,
                playerNum: this.session.playerNum,
                dungeonId: this.session.dungeonId,
            });
        }
    }

    handleMatchStarting(msg) {
        const message = msg?.message || 'Match found, launching…';
        this.uiController.setStatus(message);
        this.uiController.setStatusError(false);

        const ttl = Number(msg?.expires_ms) || 4000;
        this._clearMatchStartingStatusTimer();
        this._matchStartingStatusTimer = setTimeout(() => {
            this.uiController.setStatus('');
            this._matchStartingStatusTimer = null;
        }, ttl);
    }

    // N-03: show live queue position / countdown for Sit-n-Go + Team queues.
    handleEndlessQueueStatus(msg) {
        this._clearMatchStartingStatusTimer();
        const waiting = Number(msg?.players_waiting ?? 0);
        const max = Number(msg?.max_players ?? 4);
        let text = `Endless BR: ${waiting} player${waiting === 1 ? '' : 's'} pooling (max ${max})`;
        text += msg?.countdown_active ? ' — launching soon…' : ' — waiting…';
        this.uiController.setStatus(text);
        this.uiController.setStatusError(false);
    }

    handleSitngoQueueStatus(msg) {
        this._clearMatchStartingStatusTimer();
        const waiting = Number(msg?.players_waiting ?? msg?.playersWaiting ?? 0);
        const min = Number(msg?.min_players ?? msg?.minPlayers ?? 0);
        const max = Number(msg?.max_players ?? msg?.maxPlayers ?? 0);
        const remaining = msg?.countdown_remaining ?? msg?.countdownRemaining ?? null;
        let text = `Sit-n-Go queue: ${waiting}${min ? `/${min}` : ''} players`;
        if (max) text += ` (max ${max})`;
        if (msg?.countdown_active && remaining != null) {
            text += ` — starting in ${Math.ceil(Number(remaining) / 1000)}s…`;
        } else {
            text += min && waiting < min
                ? ` — waiting for ${min - waiting} more…`
                : ' — waiting…';
        }
        this.uiController.setStatus(text);
        this.uiController.setStatusError(false);
    }

    handleTeamQueueStatus(msg) {
        this._clearMatchStartingStatusTimer();
        const waiting = Number(msg?.players_waiting ?? msg?.playersWaiting ?? 0);
        const teams = msg?.teams_possible ?? msg?.teamsPossible ?? Math.floor(waiting / 2);
        const remaining = msg?.countdown_remaining ?? msg?.countdownRemaining ?? null;
        const mode = msg?.mode === 'team-sitngo' ? 'Team Sit-n-Go' : 'Team';
        let text = `${mode} queue: ${waiting} players (${teams} team${Number(teams) === 1 ? '' : 's'})`;
        if (msg?.countdown_active && remaining != null) {
            text += ` — starting in ${Math.ceil(Number(remaining) / 1000)}s…`;
        } else {
            text += ' — waiting…';
        }
        this.uiController.setStatus(text);
        this.uiController.setStatusError(false);
    }

    handleState(msg) {
        // WIRE-2: feed the interpolator; the render loop pulls the
        // interpolated frame. Keep lastState = newest raw snapshot so HUD,
        // audio and automation hooks keep working unchanged.
        try {
            const interp = typeof this.getInterpolator === 'function' ? this.getInterpolator() : null;
            if (interp && msg.state) interp.push(msg.state);
        } catch (_) { /* interpolation is best-effort */ }
        this.setLastState(msg.state);
        this.session.dungeonId = msg.state.dungeonId;
        this.audio.processSounds(msg.state.sounds, this.options.sound === 'on');
        if (window.engine?._setMultiplayerState) {
            window.engine._setMultiplayerState(msg.state);
        }
        this._refreshTeamHudFromState(msg.state);

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

    handleMatchEnd(msg) {
        const stats = msg.stats || {};
        const mode = stats.matchMode || 'unknown';
        const score = stats.score ?? 0;
        const level = stats.level ?? 0;
        const durationMs = stats.duration ?? 0;
        const durationSec = Math.round(durationMs / 1000);
        const minutes = Math.floor(durationSec / 60);
        const seconds = durationSec % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const modeLabels = {
            endless_br: 'Endless Battle Royale',
            sitngo_br: 'Sit-N-Go Battle Royale',
            team_endless_br: 'Team Endless BR',
            team_sitngo_br: 'Team Sit-N-Go BR',
            classic_private_pair: 'Classic 2-Player',
        };
        const modeLabel = modeLabels[mode] || mode;
        const modeToJoinType = {
            endless_br: 'join_endless_br',
            sitngo_br: 'join_sitngo_br',
            team_endless_br: 'join_team_endless_br',
            team_sitngo_br: 'join_team_sitngo_br',
        };
        const joinType = modeToJoinType[mode] || null;
        const playAgainLabel = joinType ? '▶ PLAY AGAIN' : '↩ RETURN TO MENU';
        const shortcutHints = joinType
            ? 'Keys: Enter = Play Again · M or Esc = Menu'
            : 'Keys: Enter/M/Esc = Menu';

        // Submit score to leaderboard API if user is logged in
        this._submitScore(score);
        this.audio.stopAll();

        // Build results overlay
        let overlay = document.getElementById('match-results-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'match-results-overlay';
            document.body.appendChild(overlay);
        }
        const titleId = 'match-results-title';
        const hintsId = 'match-results-hints';
        this._lastFocusedElement = (typeof document !== 'undefined')
            ? document.activeElement
            : null;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Match results');
        overlay.setAttribute('aria-labelledby', titleId);
        overlay.setAttribute('aria-describedby', hintsId);

        overlay.innerHTML = `
            <div class="match-results-card" tabindex="-1">
                <h2 id="${titleId}">GAME OVER</h2>
                <div class="match-results-mode">${modeLabel}</div>
                <div class="match-results-stats">
                    <div class="stat"><span class="stat-value">${score.toLocaleString()}</span><span class="stat-label">SCORE</span></div>
                    <div class="stat"><span class="stat-value">${level}</span><span class="stat-label">LEVEL</span></div>
                    <div class="stat"><span class="stat-value">${timeStr}</span><span class="stat-label">TIME</span></div>
                </div>
                <div class="match-results-actions">
                    <button class="btn match-btn-play-again" id="match-play-again" aria-keyshortcuts="Enter">${playAgainLabel}</button>
                    <button class="btn match-btn-menu" id="match-back-menu" aria-keyshortcuts="M Escape">☰ BACK TO MENU</button>
                </div>
                <div class="match-results-hints" id="${hintsId}">${shortcutHints}</div>
            </div>
        `;
        overlay.classList.add('visible');
        document.body.classList.add('match-results-open');
        this._isMatchResultsBusy = false;

        // Wire up buttons
        const playAgainBtn = document.getElementById('match-play-again');
        const backToMenuBtn = document.getElementById('match-back-menu');
        playAgainBtn?.addEventListener('click', () => {
            this._setMatchResultsBusy(true);
            this._hideMatchResultsOverlay();
            if (joinType) {
                this.uiController.setStatus('Re-queueing…');
                this.uiController.setStatusError(false);
                // Disconnect current socket and reconnect with same mode
                this._requeue(joinType);
            } else {
                // Non-requeue mode — go back to menu
                this._backToMenu();
            }
        });

        backToMenuBtn?.addEventListener('click', () => {
            this._setMatchResultsBusy(true);
            this._hideMatchResultsOverlay();
            this._backToMenu();
        });

        // Accessibility: focus first action and support Escape to menu
        playAgainBtn?.focus();
        overlay.onkeydown = (event) => {
            if (this._isMatchResultsBusy) {
                event.preventDefault();
                return;
            }
            if (event.key === 'Escape') {
                this._hideMatchResultsOverlay();
                this._backToMenu();
            } else if (event.key === 'Enter') {
                event.preventDefault();
                playAgainBtn?.click();
            } else if (event.key?.toLowerCase() === 'm') {
                event.preventDefault();
                backToMenuBtn?.click();
            } else if (event.key === 'Tab' && playAgainBtn && backToMenuBtn) {
                event.preventDefault();
                const current = document.activeElement;
                if (event.shiftKey) {
                    (current === playAgainBtn ? backToMenuBtn : playAgainBtn).focus();
                } else {
                    (current === backToMenuBtn ? playAgainBtn : backToMenuBtn).focus();
                }
            }
        };
        overlay.onclick = (event) => {
            if (this._isMatchResultsBusy) return;
            if (event.target === overlay) {
                this._setMatchResultsBusy(true);
                this._hideMatchResultsOverlay();
                this._backToMenu();
            }
        };

        // Dispatch DOM event for automation/debug hooks
        document.dispatchEvent(new CustomEvent('swow:match-end', { detail: msg.stats }));
    }

    _requeue(joinType) {
        // Use the session controller's exitToMenu and then reconnect
        const exitBtn = document.getElementById('overlay');
        if (exitBtn) exitBtn.classList.remove('hide');
        // Programmatically trigger the matching mode button
        const modeToBtn = {
            join_endless_br: 'btnSolo',
            join_sitngo_br: 'btnSitNGo',
            join_team_endless_br: 'btnTeamBr',
            join_team_sitngo_br: 'btnTeamSitNGo',
        };
        const btnId = modeToBtn[joinType];
        const btn = document.getElementById(btnId);
        if (btn) {
            // Small delay to let socket close cleanly
            setTimeout(() => btn.click(), 300);
        }
    }

    _backToMenu() {
        this._hideMatchResultsOverlay();
        this.uiController.showOverlay();
        this.uiController.hideGameSurface();
        this.audio.stopAll();
        this.uiController.setStatus('Select a mode to join.');
        this.uiController.setStatusError(false);
        this.uiController.setButtonState(false);
    }

    _hideMatchResultsOverlay() {
        const overlay = document.getElementById('match-results-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            overlay.onkeydown = null;
            overlay.onclick = null;
        }
        document.body.classList.remove('match-results-open');
        if (typeof HTMLElement !== 'undefined' && this._lastFocusedElement instanceof HTMLElement) {
            this._lastFocusedElement.focus?.();
        }
        this._lastFocusedElement = null;
        this._isMatchResultsBusy = false;
    }

    _setMatchResultsBusy(isBusy) {
        this._isMatchResultsBusy = !!isBusy;
        const playAgainBtn = document.getElementById('match-play-again');
        const backToMenuBtn = document.getElementById('match-back-menu');
        if (playAgainBtn) playAgainBtn.disabled = !!isBusy;
        if (backToMenuBtn) backToMenuBtn.disabled = !!isBusy;
    }

    _submitScore(score) {
        if (!score || score <= 0) return;
        try {
            const token = localStorage.getItem('communityToken');
            const userId = localStorage.getItem('communityUserId');
            if (!token || !userId) return; // not logged in
            const apiBase = window.__SWOW_API_BASE__ || '/api/community';
            fetch(`${apiBase}/leaderboards/score`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ user_id: userId, score }),
            }).catch(() => { /* best-effort */ });
        } catch (_) { /* ignore */ }
    }

    _playerColorLabel(playerNum) {
        // ROOM-1: only 2 sprite palettes — slots share by parity.
        return (playerNum ?? 0) % 2 === 0 ? '🟡 Yellow' : '🔵 Blue';
    }

    // Derive the teammate colour from live server team data (players sharing
    // our colorNum are teammates) instead of assuming the opposite slot.
    _refreshTeamHudFromState(state) {
        try {
            const isTeamMode = typeof this.session.matchMode === 'string'
                && this.session.matchMode.startsWith('team_');
            if (!isTeamMode || !state || !Array.isArray(state.players)) return;
            const me = state.players.find((p) => p && p.id === this.session.playerId)
                ?? state.players[this.session.playerNum];
            if (!me) return;
            const mate = state.players.find((p) => p && p !== me
                && p.id && !String(p.id).startsWith('bot-')
                && (p.colorNum ?? p.num) === (me.colorNum ?? me.num));
            const myLabel = this._playerColorLabel(me.colorNum ?? me.num ?? this.session.playerNum);
            const mateLabel = mate
                ? this._playerColorLabel(mate.colorNum ?? mate.num)
                : myLabel;
            this.uiController.setHudDungeonText(`Team BR • You: ${myLabel} • Teammate: ${mateLabel}`);
        } catch (_) { /* HUD hint is best-effort; never break state handling */ }
    }

    _clearMatchStartingStatus() {
        this._clearMatchStartingStatusTimer();
        this.uiController.setStatus('');
    }

    // Alias kept for call sites using the dismiss-with-options naming.
    _dismissMatchStartingStatus({ clearText = true } = {}) {
        this._clearMatchStartingStatusTimer();
        if (clearText) this.uiController.setStatus('');
    }

    _clearMatchStartingStatusTimer() {
        if (this._matchStartingStatusTimer) {
            clearTimeout(this._matchStartingStatusTimer);
            this._matchStartingStatusTimer = null;
        }
    }
}

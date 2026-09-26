export class MultiplayerSessionController {
    constructor({
        uiController,
        audio,
        getSocketClient,
        onResetState,
        reconnectBaseDelayMs = 800,
        reconnectMaxAttempts = 4,
    }) {
        this.uiController = uiController;
        this.audio = audio;
        this.getSocketClient = getSocketClient;
        this.onResetState = onResetState;
        this.reconnectBaseDelayMs = reconnectBaseDelayMs;
        this.reconnectMaxAttempts = reconnectMaxAttempts;

        this._lastJoinType = null;
        this._lastJoinPayload = null;
        this._isConnecting = false;
        this._hasJoinedGame = false;
        this._reconnectAttempt = 0;
        this._reconnectTimer = null;
    }

    getLastJoinType() {
        return this._lastJoinType;
    }

    getLastJoinPayload() {
        return this._lastJoinPayload;
    }

    isConnecting() {
        return this._isConnecting;
    }

    hasJoinedGame() {
        return this._hasJoinedGame;
    }

    setIsConnecting(value) {
        this._isConnecting = !!value;
    }

    setHasJoinedGame(value) {
        this._hasJoinedGame = !!value;
    }

    connect(joinType, payload = null, { isReconnect = false } = {}) {
        if (this._isConnecting) return;
        if (!isReconnect) {
            this._clearReconnectTimer();
            this._reconnectAttempt = 0;
        }
        const socketClient = this.getSocketClient();
        if (!socketClient) return;
        if (socketClient.isOpenOrConnecting()) return;

        this._isConnecting = true;
        this._lastJoinType = joinType;
        this._lastJoinPayload = payload;
        this.uiController.setButtonState(true);
        this.uiController.toggleRetry(false);
        this.uiController.setStatus('Connecting…');
        this.uiController.setStatusError(false);

        const didConnect = socketClient.connect(joinType, payload);
        if (!didConnect) {
            this._isConnecting = false;
            this.uiController.setButtonState(false);
        }
    }

    handleSocketClose() {
        this._isConnecting = false;
        this.uiController.setButtonState(false);
        this.uiController.toggleRetry(!!this._lastJoinType);
        const shouldAutoReconnect = this._hasJoinedGame && !!this._lastJoinType;
        if (shouldAutoReconnect) {
            this._scheduleReconnect();
        } else {
            this.uiController.setStatus('Connection closed before game start. Retry to connect.');
            this.uiController.setStatusError(true);
        }
        this.uiController.showOverlay();
    }

    handleSocketOpen() {
        this._clearReconnectTimer();
        this._reconnectAttempt = 0;
    }

    handleSocketError() {
        this.uiController.setStatus('Connection error — check server status and try again.');
        this.uiController.setStatusError(true);
    }

    exitToMenu() {
        this._clearReconnectTimer();
        this._reconnectAttempt = 0;
        try {
            sessionStorage.removeItem('swow_resume_token');
        } catch (_) { /* noop */ }
        const socketClient = this.getSocketClient();
        if (socketClient) socketClient.disconnect();
        if (typeof this.onResetState === 'function') this.onResetState();
        this._hasJoinedGame = false;
        this.uiController.hideGameSurface();
        this.audio.stopAll();
        this.uiController.showOverlay();
        this.uiController.toggleRetry(!!this._lastJoinType);
        this.uiController.setButtonState(false);
        this.uiController.setStatus('Select a mode to join.');
        this.uiController.setStatusError(false);
    }

    _scheduleReconnect() {
        if (this._reconnectAttempt >= this.reconnectMaxAttempts) {
            this.uiController.setStatus('Disconnected from server. Auto-reconnect failed, please reconnect.');
            this.uiController.setStatusError(true);
            return;
        }
        const attempt = this._reconnectAttempt + 1;
        const delayMs = this.reconnectBaseDelayMs * (2 ** this._reconnectAttempt);
        const sec = (delayMs / 1000).toFixed(delayMs >= 1000 ? 1 : 0);
        this.uiController.setStatus(`Disconnected. Reconnecting in ${sec}s… (attempt ${attempt}/${this.reconnectMaxAttempts})`);
        this.uiController.setStatusError(false);

        this._clearReconnectTimer();
        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            this._reconnectAttempt += 1;
            // RESUME-1: rejoining after a drop resumes the live slot via the
            // cached token instead of starting a new dungeon.
            let joinType = this._lastJoinType;
            let payload = this._lastJoinPayload;
            try {
                const token = sessionStorage.getItem('swow_resume_token');
                if (token && this._hasJoinedGame) {
                    joinType = 'resume_session';
                    payload = { token };
                }
            } catch (_) { /* storage may be unavailable */ }
            this.connect(joinType, payload, { isReconnect: true });
        }, delayMs);
    }

    _clearReconnectTimer() {
        if (!this._reconnectTimer) return;
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
    }
}

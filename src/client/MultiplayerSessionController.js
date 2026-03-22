export class MultiplayerSessionController {
    constructor({
        uiController,
        audio,
        getSocketClient,
        onResetState,
    }) {
        this.uiController = uiController;
        this.audio = audio;
        this.getSocketClient = getSocketClient;
        this.onResetState = onResetState;

        this._lastJoinType = null;
        this._lastJoinPayload = null;
        this._isConnecting = false;
        this._hasJoinedGame = false;
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

    connect(joinType, payload = null) {
        if (this._isConnecting) return;
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
        this.uiController.setStatus(this._hasJoinedGame
            ? 'Disconnected from server. Retry to reconnect.'
            : 'Connection closed before game start. Retry to connect.');
        this.uiController.setStatusError(true);
        this.uiController.showOverlay();
    }

    handleSocketError() {
        this.uiController.setStatus('Connection error — check server status and try again.');
        this.uiController.setStatusError(true);
    }

    exitToMenu() {
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
}

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
        this.uiController.setStatus(`Private room created. Share code: ${msg.code}`);
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
        // Resume audio context after user interaction
        if (this.audio.ctx && this.audio.ctx.state === 'suspended') {
            this.audio.ctx.resume();
        }
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

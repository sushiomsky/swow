import { SERVER_EVENTS } from './multiplayerEvents.js';

export class MultiplayerMessageController {
    constructor({
        session,
        uiController,
        audio,
        options,
        getLastJoinType,
        onJoinError,
        onInit,
        setLastState,
        onCopyPrivateLink,
    }) {
        this.session = session;
        this.uiController = uiController;
        this.audio = audio;
        this.options = options;
        this.getLastJoinType = getLastJoinType;
        this.onJoinError = onJoinError;
        this.onInit = onInit;
        this.setLastState = setLastState;
        this.onCopyPrivateLink = onCopyPrivateLink;
    }

    handle(msg) {
        switch (msg.type) {
            case SERVER_EVENTS.CONNECTED:
                this.session.playerId = msg.playerId;
                break;

            case SERVER_EVENTS.WAITING_FOR_PARTNER:
                this.uiController.setStatus('Waiting for second player to join…');
                break;

            case SERVER_EVENTS.WAITING_FOR_SITNGO:
                this.uiController.setStatus(`Sit-n-Go queue: ${msg.queued}/${msg.minPlayers} players. Waiting…`);
                break;

            case SERVER_EVENTS.PRIVATE_PAIR_CREATED:
                this.uiController.setStatus(`Private room created. Share code: ${msg.code}`);
                this.onCopyPrivateLink(msg);
                break;

            case SERVER_EVENTS.JOIN_ERROR:
                this.uiController.setStatus(msg.message || 'Unable to join this mode.');
                this.uiController.setStatusError(true);
                this.uiController.setButtonState(false);
                this.uiController.toggleRetry(!!this.getLastJoinType());
                if (typeof this.onJoinError === 'function') this.onJoinError(msg);
                break;

            case SERVER_EVENTS.INIT:
                if (typeof this.onInit === 'function') this.onInit(msg);
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
                break;

            case SERVER_EVENTS.STATE:
                this.setLastState(msg.state);
                this.session.dungeonId = msg.state.dungeonId;
                this.audio.processSounds(msg.state.sounds, this.options.sound === 'on');
                break;
        }
    }

    _buildHudText(msg) {
        const teamText = msg.team ? ` | Team: ${msg.team.toUpperCase()}` : '';
        const modeText = msg.mode ? ` | Mode: ${msg.mode.replaceAll('_', ' ').toUpperCase()}` : '';
        const playerColor = this.session.playerNum === 0 ? '🟡 Yellow' : '🔵 Blue';
        return `Dungeon ${this.session.dungeonId} | You: ${playerColor}${teamText}${modeText}`;
    }
}

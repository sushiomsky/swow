import { CLIENT_EVENTS } from './multiplayerEvents.js';

const AUTO_MODE_MAP = {
    endless: CLIENT_EVENTS.JOIN_SOLO,
    sitngo: CLIENT_EVENTS.JOIN_SITNGO,
    'sit-n-go': CLIENT_EVENTS.JOIN_SITNGO,
    team: CLIENT_EVENTS.JOIN_TEAM_BR,
    'team-br': CLIENT_EVENTS.JOIN_TEAM_BR,
    'pair-host': CLIENT_EVENTS.JOIN_PAIR,
    'private-host': CLIENT_EVENTS.JOIN_PAIR,
    'pair-join': CLIENT_EVENTS.JOIN_PRIVATE_PAIR,
    'private-join': CLIENT_EVENTS.JOIN_PRIVATE_PAIR
};

export class MultiplayerLaunchController {
    constructor({
        uiController,
        onConnect,
        getLastJoinType,
        getLastJoinPayload
    }) {
        this.uiController = uiController;
        this.onConnect = onConnect;
        this.getLastJoinType = getLastJoinType;
        this.getLastJoinPayload = getLastJoinPayload;
    }

    bindButtons() {
        document.getElementById('btnSolo').onclick = () => this.onConnect(CLIENT_EVENTS.JOIN_SOLO);
        document.getElementById('btnSitNGo').onclick = () => this.onConnect(CLIENT_EVENTS.JOIN_SITNGO);
        document.getElementById('btnTeamBr').onclick = () => this.onConnect(CLIENT_EVENTS.JOIN_TEAM_BR);
        document.getElementById('btnPairCreate').onclick = () => this.onConnect(CLIENT_EVENTS.JOIN_PAIR);
        document.getElementById('btnPairJoin').onclick = () => {
            const codeEl = document.getElementById('pairCode');
            const code = (codeEl?.value || '').trim();
            if (!code) {
                this.uiController.setStatus('Enter a private code first.');
                this.uiController.setStatusError(true);
                return;
            }
            this.onConnect(CLIENT_EVENTS.JOIN_PRIVATE_PAIR, { code });
        };
        document.getElementById('btnRetry').onclick = () => {
            const lastJoinType = this.getLastJoinType();
            if (lastJoinType) this.onConnect(lastJoinType, this.getLastJoinPayload());
        };
    }

    applyAutoJoinFromUrl() {
        const params = new URLSearchParams(location.search);
        const autoCode = params.get('room') || params.get('pair');
        if (autoCode) {
            const codeEl = document.getElementById('pairCode');
            if (codeEl) codeEl.value = autoCode;
            // Auto-join immediately with the detected code
            this.onConnect(CLIENT_EVENTS.JOIN_PRIVATE_PAIR, { code: autoCode });
            return;
        }

        const modeParam = params.get('mode');
        const normalizedMode = String(modeParam || '').trim().toLowerCase();
        const autoJoinType = AUTO_MODE_MAP[normalizedMode];
        if (!autoJoinType) return;

        if (autoJoinType === CLIENT_EVENTS.JOIN_PRIVATE_PAIR) {
            this.uiController.setStatus('Private join mode selected. Enter a code to continue.');
            this.uiController.setStatusError(false);
            return;
        }
        this.onConnect(autoJoinType);
    }
}

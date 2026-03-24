import { CLIENT_EVENTS } from './multiplayerEvents.js';

export class MultiplayerLaunchController {
    constructor({ uiController, onConnect }) {
        this.uiController = uiController;
        this.onConnect = onConnect;
    }

    bindButtons() {
        // Private pair buttons
        const createBtn = document.getElementById('btnPairCreate');
        if (createBtn) createBtn.onclick = () => this.onConnect(CLIENT_EVENTS.JOIN_PAIR);

        const joinBtn = document.getElementById('btnPairJoin');
        if (joinBtn) joinBtn.onclick = () => {
            const codeEl = document.getElementById('pairCode');
            const code = (codeEl?.value || '').trim();
            if (!code) {
                this.uiController.setStatus('Enter a room code first.');
                this.uiController.setStatusError(true);
                return;
            }
            this.onConnect(CLIENT_EVENTS.JOIN_PRIVATE_PAIR, { code });
        };

        // Battle Royale mode buttons
        const btnSolo = document.getElementById('btnSolo');
        if (btnSolo) {
            btnSolo.onclick = () => {
                console.log('[Launch] Starting Endless BR mode');
                this.uiController.setStatus('Joining Endless Battle Royale...');
                // For now, create a regular private pair
                // TODO: Implement proper BR matchmaking
                this.onConnect(CLIENT_EVENTS.JOIN_PAIR);
            };
        }

        const btnSitNGo = document.getElementById('btnSitNGo');
        if (btnSitNGo) {
            btnSitNGo.onclick = () => {
                console.log('[Launch] Starting Sit-n-Go BR mode');
                this.uiController.setStatus('Joining Sit-n-Go BR queue...');
                // TODO: Implement sit-n-go matchmaking
                this.onConnect(CLIENT_EVENTS.JOIN_PAIR);
            };
        }

        const btnTeamBr = document.getElementById('btnTeamBr');
        if (btnTeamBr) {
            btnTeamBr.onclick = () => {
                console.log('[Launch] Starting Team BR mode');
                this.uiController.setStatus('Joining Team Battle Royale...');
                // TODO: Implement team BR matchmaking
                this.onConnect(CLIENT_EVENTS.JOIN_PAIR);
            };
        }
    }

    applyAutoJoinFromUrl() {
        const params = new URLSearchParams(location.search);
        const autoCode = params.get('room') || params.get('pair');
        if (autoCode) {
            const codeEl = document.getElementById('pairCode');
            if (codeEl) codeEl.value = autoCode;
            this.onConnect(CLIENT_EVENTS.JOIN_PRIVATE_PAIR, { code: autoCode });
        }
    }
}

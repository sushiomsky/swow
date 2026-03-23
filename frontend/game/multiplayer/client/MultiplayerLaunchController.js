import { CLIENT_EVENTS } from './multiplayerEvents.js';

export class MultiplayerLaunchController {
    constructor({ uiController, onConnect }) {
        this.uiController = uiController;
        this.onConnect = onConnect;
    }

    bindButtons() {
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

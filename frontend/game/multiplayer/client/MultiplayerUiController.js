import { q } from '../../shared/utils.js';

export class MultiplayerUiController {
    setStatus(message) {
        const el = document.getElementById('status');
        if (el) el.textContent = message;
    }

    setStatusError(isError) {
        const el = document.getElementById('status');
        if (el) el.classList.toggle('error', !!isError);
    }

    setButtonState(disabled) {
        const ids = ['btnSolo', 'btnSitNGo', 'btnTeamBr', 'btnPairCreate', 'btnPairJoin', 'btnRetry'];
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el) el.disabled = !!disabled;
        }
    }

    toggleRetry(show) {
        const el = document.getElementById('btnRetry');
        if (el) el.classList.toggle('hide', !show);
    }

    hideOverlay() {
        const el = document.getElementById('overlay');
        if (el) el.classList.add('hide');
    }

    showOverlay() {
        const el = document.getElementById('overlay');
        if (el) el.classList.remove('hide');
    }

    showGameSurface() {
        q('screen').classList.remove('hide');
        q('hud').classList.remove('hide');
    }

    hideGameSurface() {
        q('screen').classList.add('hide');
        q('hud').classList.add('hide');
    }

    setHudDungeonText(text) {
        const el = document.getElementById('hud-dungeon');
        if (el) el.textContent = text;
    }
}

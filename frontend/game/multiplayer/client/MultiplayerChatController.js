import { CLIENT_EVENTS } from './multiplayerEvents.js';

/**
 * MultiplayerChatController — minimal lobby/match chat UI (CHAT-1).
 *
 * A collapsible panel (💬 button, bottom-left). Messages render newest-last
 * (max 30 kept). Sending goes through the socket client directly.
 * History from init/resumed is replayed once via replayHistory().
 */
export class MultiplayerChatController {
    constructor({ getSocketClient, getPlayerId }) {
        this.getSocketClient = getSocketClient;
        this.getPlayerId = getPlayerId;
        this.messages = [];
        this.unread = 0;
        this.open = false;
        this._built = false;
    }

    /** Build the DOM once (idempotent). */
    ensureUi() {
        if (this._built) return;
        this._built = true;

        const btn = document.createElement('button');
        btn.id = 'mp-chat-fab';
        btn.title = 'Lobby chat';
        btn.textContent = '💬';
        btn.style.cssText = [
            'position:fixed', 'bottom:20px', 'left:20px', 'z-index:900',
            'width:48px', 'height:48px', 'border-radius:50%', 'border:none',
            'background:#0e7490', 'color:#fff', 'font-size:22px', 'cursor:pointer',
            'box-shadow:0 4px 14px rgba(14,116,144,0.4)',
        ].join(';');
        btn.addEventListener('click', () => this.toggle());
        document.body.appendChild(btn);
        this.fab = btn;

        const badge = document.createElement('span');
        badge.id = 'mp-chat-badge';
        badge.style.cssText = [
            'position:absolute', 'top:-4px', 'right:-4px', 'display:none',
            'background:#ef4444', 'color:#fff', 'font-size:11px', 'font-weight:700',
            'border-radius:10px', 'padding:1px 6px', 'line-height:1.4',
        ].join(';');
        btn.style.position = 'fixed';
        btn.appendChild(badge);
        this.badge = badge;

        const panel = document.createElement('div');
        panel.id = 'mp-chat-panel';
        panel.style.cssText = [
            'display:none', 'position:fixed', 'left:20px', 'bottom:80px', 'z-index:950',
            'width:min(320px,86vw)', 'background:#18181b', 'border:1px solid #333',
            'border-radius:12px', 'color:#f5f5f5', 'font-family:ui-sans-serif,system-ui,sans-serif',
            'box-shadow:0 8px 30px rgba(0,0,0,0.5)',
        ].join(';');
        panel.innerHTML = `
            <div style="padding:10px 12px;border-bottom:1px solid #333;font-weight:600;font-size:14px;">💬 Lobby Chat</div>
            <div id="mp-chat-log" style="height:180px;overflow-y:auto;padding:8px 12px;font-size:13px;line-height:1.5;"></div>
            <div style="display:flex;gap:6px;padding:8px 12px;border-top:1px solid #333;">
                <input id="mp-chat-input" type="text" maxlength="140" placeholder="Message… (Enter)"
                    style="flex:1;padding:8px 10px;border:1px solid #444;border-radius:8px;background:#111;color:#f5f5f5;font-size:13px;">
                <button id="mp-chat-send" style="padding:8px 12px;border:none;border-radius:8px;background:#0e7490;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">➤</button>
            </div>`;
        document.body.appendChild(panel);
        this.panel = panel;
        this.log = panel.querySelector('#mp-chat-log');
        this.input = panel.querySelector('#mp-chat-input');
        const send = () => this.send();
        panel.querySelector('#mp-chat-send').addEventListener('click', send);
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') send();
            e.stopPropagation();
        });
    }

    toggle(force) {
        this.ensureUi();
        this.open = typeof force === 'boolean' ? force : !this.open;
        this.panel.style.display = this.open ? 'block' : 'none';
        if (this.open) {
            this.unread = 0;
            this._renderBadge();
            this.input.focus();
            this._scrollDown();
        }
    }

    /** Incoming chat_msg from the server. */
    pushMessage({ from, text, at }) {
        this.ensureUi();
        const mine = typeof this.getPlayerId === 'function' && this.getPlayerId() === from;
        this.messages.push({ from, text, at: at || Date.now(), mine });
        if (this.messages.length > 30) this.messages.splice(0, this.messages.length - 30);
        const div = document.createElement('div');
        const label = mine ? 'You' : `P${String(from).slice(-4)}`;
        div.innerHTML = `<b style="color:${mine ? '#67e8f9' : '#fbbf24'}"></b> <span></span>`;
        div.querySelector('b').textContent = label;
        div.querySelector('span').textContent = `: ${text}`;
        this.log.appendChild(div);
        while (this.log.children.length > 30) this.log.firstChild.remove();
        if (this.open) this._scrollDown();
        else {
            this.unread += 1;
            this._renderBadge();
        }
    }

    /** Replay init/resumed history once. */
    replayHistory(history) {
        if (!Array.isArray(history)) return;
        for (const m of history) this.pushMessage(m);
    }

    showError(message) {
        this.ensureUi();
        const div = document.createElement('div');
        div.style.color = '#f87171';
        div.textContent = message || 'Chat failed.';
        this.log.appendChild(div);
        this._scrollDown();
    }

    send() {
        const text = (this.input?.value || '').trim();
        if (!text) return;
        const socketClient = typeof this.getSocketClient === 'function' ? this.getSocketClient() : null;
        if (!socketClient || !socketClient.send({ type: CLIENT_EVENTS.CHAT_SEND, text: text.slice(0, 140) })) {
            this.showError('Not connected.');
            return;
        }
        this.input.value = '';
    }

    _scrollDown() {
        if (this.log) this.log.scrollTop = this.log.scrollHeight;
    }

    _renderBadge() {
        if (!this.badge) return;
        this.badge.style.display = this.unread > 0 ? 'inline' : 'none';
        this.badge.textContent = this.unread > 9 ? '9+' : String(this.unread);
    }
}

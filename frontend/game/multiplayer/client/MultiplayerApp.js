/**
 * MultiplayerApp.js
 *
 * Browser-side orchestrator for 2-player private rooms.
 *
 * WebSocket protocol (client → server):
 *   { type: 'join_pair' }              — create a private 2-player room
 *   { type: 'join_private_pair', code }— join by room code
 *   { type: 'input', keys: {...} }     — raw key state
 *
 * WebSocket protocol (server → client):
 *   { type: 'connected', playerId }
 *   { type: 'init', playerId, playerNum, dungeonId }
 *   { type: 'state', state: {...} }
 *   { type: 'waiting_for_partner' }
 *   { type: 'private_pair_created', code, joinUrl }
 *   { type: 'join_error', message }
 */

import { MultiplayerSocketClient } from './MultiplayerSocketClient.js';
import { CLIENT_EVENTS } from './multiplayerEvents.js';
import { MultiplayerInputController } from './MultiplayerInputController.js';
import { MultiplayerAudioPlayer } from './MultiplayerAudioPlayer.js';
import { MultiplayerUiController } from './MultiplayerUiController.js';
import { MultiplayerLaunchController } from './MultiplayerLaunchController.js';
import { MultiplayerMessageController } from './MultiplayerMessageController.js';
import { MultiplayerMessageEffectsController } from './MultiplayerMessageEffectsController.js';
import { MultiplayerShareController } from './MultiplayerShareController.js';
import { MultiplayerSessionController } from './MultiplayerSessionController.js';
import { MultiplayerAppBootstrapController } from './MultiplayerAppBootstrapController.js';
import {
    SharedControlsRuntime,
    createKeyboardBinding,
    readControlBinding,
    writeControlBinding,
    getDeviceValue,
} from '../../shared/input/SharedControls.js';

const MULTIPLAYER_CONTROL_STORAGE_KEY = 'multiplayerControlBinding';

class MultiplayerApp {
    constructor() {
        this.session = { playerId: null, playerNum: null, dungeonId: null };
        this.lastState = null;
        this.socketClient = null;
        this.sessionController = null;
        this.renderer = null;
        this.audio = new MultiplayerAudioPlayer();
        this.controlsRuntime = new SharedControlsRuntime();
        this.inputController = null;
        this.uiController = new MultiplayerUiController();
        this.launchController = null;
        this.messageController = null;
        this.messageEffectsController = null;
        this.shareController = new MultiplayerShareController({ uiController: this.uiController });
        this.bootstrapController = null;
        this.options = {
            visualFilter: localStorage.getItem('visualFilter') || 'scanlines',
            controlBinding: readControlBinding(MULTIPLAYER_CONTROL_STORAGE_KEY, createKeyboardBinding('arrows')),
            controlDevice: 'keyboard',
            sound: localStorage.getItem('sound') || 'on',
        };
        writeControlBinding(MULTIPLAYER_CONTROL_STORAGE_KEY, this.options.controlBinding);
        this.options.controlDevice = getDeviceValue(this.options.controlBinding);

        this._bootstrap();
    }

    async _bootstrap() {
        this.bootstrapController = new MultiplayerAppBootstrapController({
            options: this.options,
            onRendererReady: (renderer) => { this.renderer = renderer; },
            initializeModules: () => this._initializeModules(),
            getLastState: () => this.lastState,
        });
        await this.bootstrapController.bootstrap();
    }

    _initializeModules() {
        this._initSessionController();
        this._initSocketClient();
        this._initInputController();
        this._initLaunchController();
        this._initMessageController();
    }

    _initSocketClient() {
        this.socketClient = new MultiplayerSocketClient({
            onOpen: () => {
                this.uiController.setStatus('Connected — create or join a room.');
                this.uiController.setStatusError(false);
            },
            onMessage: (rawData) => {
                try {
                    this._handleMessage(JSON.parse(rawData));
                } catch (e) {
                    this.uiController.setStatus('Received invalid server message.');
                    this.uiController.setStatusError(true);
                }
            },
            onClose: () => this.sessionController?.handleSocketClose(),
            onError: () => this.sessionController?.handleSocketError(),
            getInputPayload: () => ({
                type: CLIENT_EVENTS.INPUT,
                keys: this.inputController ? this.inputController.getControls() : { up: false, down: false, left: false, right: false, fire: false },
            }),
            inputIntervalMs: 20,
        });
    }

    _initSessionController() {
        this.sessionController = new MultiplayerSessionController({
            uiController: this.uiController,
            audio: this.audio,
            getSocketClient: () => this.socketClient,
            onResetState: () => { this.lastState = null; },
        });
    }

    _initInputController() {
        this.inputController = new MultiplayerInputController({
            runtime: this.controlsRuntime,
            getControlBinding: () => this.options.controlBinding,
            onToggleSettings: () => {},
            onExitToMenu: () => this.sessionController?.exitToMenu(),
            isSettingsVisible: () => false,
        });
        this.inputController.attach();
    }

    _initLaunchController() {
        this.launchController = new MultiplayerLaunchController({
            uiController: this.uiController,
            onConnect: (joinType, payload = null) => this._connect(joinType, payload),
        });
        this.launchController.bindButtons();
        this.launchController.applyAutoJoinFromUrl();
    }

    _initMessageController() {
        this.messageEffectsController = new MultiplayerMessageEffectsController({
            session: this.session,
            uiController: this.uiController,
            audio: this.audio,
            options: this.options,
            setIsConnecting: (value) => this.sessionController?.setIsConnecting(value),
            setHasJoinedGame: (value) => this.sessionController?.setHasJoinedGame(value),
            setLastState: (state) => { this.lastState = state; },
            onCopyPrivateLink: (msg) => this.shareController.copyPrivateLink(msg),
        });
        this.messageController = new MultiplayerMessageController({
            effectsController: this.messageEffectsController,
        });
    }

    _connect(joinType, payload = null) {
        this.sessionController?.connect(joinType, payload);
    }

    _handleMessage(msg) {
        this.messageController.handle(msg);
    }

    destroy() {
        if (this.socketClient) this.socketClient.disconnect();
        if (this.bootstrapController) this.bootstrapController.stopRenderLoop();
        if (this.controlsRuntime) this.controlsRuntime.detach();
        if (this.audio) this.audio.stopAll();
        this.lastState = null;
    }
}

// Lifecycle API for platform integration
let _instance = null;

export function initMultiplayer() {
    if (_instance) return _instance;
    _instance = new MultiplayerApp();
    return _instance;
}

export function destroyMultiplayer() {
    if (!_instance) return;
    _instance.destroy();
    _instance = null;
}

export { MultiplayerApp };

// Auto-init when loaded as a standalone page (multiplayer.html direct usage)
if (!window.__SWOW_PLATFORM__) {
    initMultiplayer();
}

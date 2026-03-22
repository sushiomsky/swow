/**
 * MultiplayerApp.js
 *
 * Browser-side orchestrator for the multiplayer "Endless Connected Dungeon" mode.
 *
 * Responsibilities:
 *   - Coordinate module lifecycle (bootstrap, session, socket, input, settings, launch UI, message dispatch)
 *   - Hold shared app state (`session`, `lastState`, `options`) used across controllers
 *   - Delegate rendering + loop setup to `MultiplayerAppBootstrapController`
 *   - Delegate connection/retry/exit flow to `MultiplayerSessionController`
 *   - Delegate server message handling to `MultiplayerMessageController`
 *
 * WebSocket message protocol (client → server):
 *   { type: 'join_solo' }              — endless battle royale dungeon
 *   { type: 'join_sitngo' }            — sit-n-go battle royale queue
 *   { type: 'join_team_br' }           — team-based battle royale
 *   { type: 'join_pair' }              — create private classic 2-player room
 *   { type: 'join_private_pair', code }— join private classic room by code
 *   { type: 'input', keys: {...} }     — raw key state { up, down, left, right, fire }
 *
 * WebSocket message protocol (server → client):
 *   { type: 'connected', playerId }    — server-assigned ID
 *   { type: 'init', playerId, playerNum, dungeonId, homeDungeonId, mode, team }
 *   { type: 'state', state: {...} }    — full serialised DungeonInstance state
 *   { type: 'waiting_for_partner' }    — paired mode: waiting for second player
 *   { type: 'waiting_for_sitngo' }     — sit-n-go: waiting for enough players
 *   { type: 'private_pair_created', code, joinUrl } — private share link
 *   { type: 'join_error', message }    — join could not be completed
 */

import { MultiplayerSocketClient } from './MultiplayerSocketClient.js';
import { CLIENT_EVENTS } from './multiplayerEvents.js';
import { MultiplayerInputController } from './MultiplayerInputController.js';
import { MultiplayerAudioPlayer } from './MultiplayerAudioPlayer.js';
import { MultiplayerSettingsController } from './MultiplayerSettingsController.js';
import { MultiplayerUiController } from './MultiplayerUiController.js';
import { MultiplayerLaunchController } from './MultiplayerLaunchController.js';
import { MultiplayerMessageController } from './MultiplayerMessageController.js';
import { MultiplayerSessionController } from './MultiplayerSessionController.js';
import { MultiplayerAppBootstrapController } from './MultiplayerAppBootstrapController.js';

// ─── Config ────────────────────────────────────────────────────────────────

const CONTROL_SCHEMES = {
    arrows: {
        label: 'ARROWS + CTRL',
        keys: { up: 38, down: 40, left: 37, right: 39, fire: 17 }
    },
    wasd: {
        label: 'WASD + LEFT SHIFT',
        keys: { up: 87, down: 83, left: 65, right: 68, fire: 16 }
    },
    ijkl: {
        label: 'IJKL + SPACE',
        keys: { up: 73, down: 75, left: 74, right: 76, fire: 32 }
    }
};
// ─── Main App ──────────────────────────────────────────────────────────────

class MultiplayerApp {
    constructor() {
        this.session = {
            playerId: null,
            playerNum: null,
            dungeonId: null,
            homeDungeonId: null,
        };
        this.lastState = null;
        this.socketClient = null;
        this.sessionController = null;
        this.renderer = null;
        this.audio = new MultiplayerAudioPlayer();
        this.inputController = null;
        this.settingsController = null;
        this.uiController = new MultiplayerUiController();
        this.launchController = null;
        this.messageController = null;
        this.bootstrapController = null;
        this.options = {
            visualFilter: localStorage.getItem('visualFilter') || 'scanlines',
            controlScheme: localStorage.getItem('multiplayerControlScheme') || 'arrows',
            sound: localStorage.getItem('sound') || 'on',
            palette: 'default'
        };

        this._bootstrap();
    }

    async _bootstrap() {
        this.bootstrapController = new MultiplayerAppBootstrapController({
            options: this.options,
            onRendererReady: (renderer) => {
                this.renderer = renderer;
            },
            initializeModules: () => this._initializeModules(),
            getLastState: () => this.lastState,
        });
        await this.bootstrapController.bootstrap();
    }

    _initializeModules() {
        this._initSessionController();
        this._initSocketClient();
        this._initInputController();
        this._initSettingsController();
        this._initLaunchController();
        this._initMessageController();
        this.settingsController.syncUI();
        this.settingsController.updateControlsHint();
    }


    _initSocketClient() {
        this.socketClient = new MultiplayerSocketClient({
            onOpen: () => {
                this.uiController.setStatus('Connected — waiting for dungeon…');
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
            onResetState: () => {
                this.lastState = null;
            },
        });
    }


    _initInputController() {
        this.inputController = new MultiplayerInputController({
            controlSchemes: CONTROL_SCHEMES,
            getControlScheme: () => this.options.controlScheme,
            onToggleSettings: (forceVisible) => this.settingsController?.toggleVisibility(forceVisible),
            onExitToMenu: () => this.sessionController?.exitToMenu(),
            isSettingsVisible: () => this.settingsController?.isVisible() || false,
        });
        this.inputController.attach();
    }


    _initSettingsController() {
        this.settingsController = new MultiplayerSettingsController({
            controlSchemes: CONTROL_SCHEMES,
            getOptions: () => this.options,
            onControlSchemeChange: (value) => this._applyControlScheme(value),
            onVisualFilterChange: (value) => this._applyVisualFilter(value),
            onSoundChange: (value) => this._applySound(value),
        });
        this.settingsController.init();
    }

    _initLaunchController() {
        this.launchController = new MultiplayerLaunchController({
            uiController: this.uiController,
            onConnect: (joinType, payload = null) => this._connect(joinType, payload),
            getLastJoinType: () => this.sessionController?.getLastJoinType(),
            getLastJoinPayload: () => this.sessionController?.getLastJoinPayload(),
        });
        this.launchController.bindButtons();
        this.launchController.applyAutoJoinFromUrl();
    }

    _initMessageController() {
        this.messageController = new MultiplayerMessageController({
            session: this.session,
            uiController: this.uiController,
            audio: this.audio,
            options: this.options,
            getLastJoinType: () => this.sessionController?.getLastJoinType(),
            onJoinError: () => this.sessionController?.setIsConnecting(false),
            onInit: () => {
                this.sessionController?.setIsConnecting(false);
                this.sessionController?.setHasJoinedGame(true);
            },
            setLastState: (state) => {
                this.lastState = state;
            },
            onCopyPrivateLink: (msg) => this._copyPrivateLink(msg),
        });
    }

    _applyControlScheme(controlScheme) {
        const nextScheme = CONTROL_SCHEMES[controlScheme] ? controlScheme : 'arrows';
        this.options.controlScheme = nextScheme;
        localStorage.setItem('multiplayerControlScheme', nextScheme);
        this.settingsController?.updateControlsHint();
    }

    _applyVisualFilter(visualFilter) {
        this.options.visualFilter = visualFilter;
        localStorage.setItem('visualFilter', visualFilter);
        this.renderer.applyVisualFilter(visualFilter);
    }

    _applySound(sound) {
        const nextSound = sound === 'off' ? 'off' : 'on';
        this.options.sound = nextSound;
        localStorage.setItem('sound', nextSound);
        if (nextSound === 'off') {
            this.audio.stopAll();
        }
    }



    _connect(joinType, payload = null) {
        this.sessionController?.connect(joinType, payload);
    }

    _handleMessage(msg) {
        this.messageController.handle(msg);
    }


    _exitToMenu() {
        this.sessionController?.exitToMenu();
    }



// Boot
new MultiplayerApp();

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
import { MultiplayerMessageEffectsController } from './MultiplayerMessageEffectsController.js';
import { MultiplayerShareController } from './MultiplayerShareController.js';
import { MultiplayerSessionController } from './MultiplayerSessionController.js';
import { MultiplayerAppBootstrapController } from './MultiplayerAppBootstrapController.js';
import {
    SharedControlsRuntime,
    createKeyboardBinding,
    describeControlAction,
    describeControlBinding,
    getDeviceValue,
    normalizeControlBinding,
    readControlBinding,
    setBindingAction,
    setBindingDevice,
    writeControlBinding,
} from '../input/SharedControls.js';

// ─── Config ────────────────────────────────────────────────────────────────

const MULTIPLAYER_CONTROL_STORAGE_KEY = 'multiplayerControlBinding';
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
        this.controlsRuntime = new SharedControlsRuntime();
        this.inputController = null;
        this.settingsController = null;
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
            palette: 'default'
        };
        writeControlBinding(MULTIPLAYER_CONTROL_STORAGE_KEY, this.options.controlBinding);
        this.options.controlDevice = getDeviceValue(this.options.controlBinding);

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
            runtime: this.controlsRuntime,
            getControlBinding: () => this.options.controlBinding,
            onToggleSettings: (forceVisible) => this.settingsController?.toggleVisibility(forceVisible),
            onExitToMenu: () => this.sessionController?.exitToMenu(),
            isSettingsVisible: () => this.settingsController?.isVisible() || false,
        });
        this.inputController.attach();
    }


    _initSettingsController() {
        this.settingsController = new MultiplayerSettingsController({
            getOptions: () => this.options,
            onControlBindingDeviceChange: (value) => this._applyControlDevice(value),
            onCaptureControlAction: (action) => this._captureControlAction(action),
            onVisualFilterChange: (value) => this._applyVisualFilter(value),
            onSoundChange: (value) => this._applySound(value),
            getControlBindingSummary: () => describeControlBinding(this.options.controlBinding),
            getControlActionSummary: (action) => describeControlAction(this.options.controlBinding, action),
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
        this.messageEffectsController = new MultiplayerMessageEffectsController({
            session: this.session,
            uiController: this.uiController,
            audio: this.audio,
            options: this.options,
            getLastJoinType: () => this.sessionController?.getLastJoinType(),
            setIsConnecting: (value) => this.sessionController?.setIsConnecting(value),
            setHasJoinedGame: (value) => this.sessionController?.setHasJoinedGame(value),
            setLastState: (state) => {
                this.lastState = state;
            },
            onCopyPrivateLink: (msg) => this.shareController.copyPrivateLink(msg),
        });
        this.messageController = new MultiplayerMessageController({
            effectsController: this.messageEffectsController,
        });
    }

    _applyControlDevice(deviceValue) {
        this.options.controlBinding = setBindingDevice(this.options.controlBinding, deviceValue);
        this.options.controlDevice = getDeviceValue(this.options.controlBinding);
        writeControlBinding(MULTIPLAYER_CONTROL_STORAGE_KEY, this.options.controlBinding);
        this.settingsController?.updateControlsHint();
        this.settingsController?.syncUI();
    }

    _captureControlAction(action) {
        this.controlsRuntime.captureNextInput({
            device: this.options.controlBinding.device,
            gamepadIndex: this.options.controlBinding.gamepadIndex,
            onCaptured: (capturedMapping) => {
                this.options.controlBinding = normalizeControlBinding(
                    setBindingAction(this.options.controlBinding, action, capturedMapping),
                    this.options.controlBinding
                );
                this.options.controlDevice = getDeviceValue(this.options.controlBinding);
                writeControlBinding(MULTIPLAYER_CONTROL_STORAGE_KEY, this.options.controlBinding);
                this.settingsController?.syncUI();
                this.settingsController?.updateControlsHint();
            },
            onStatus: (statusText) => {
                const status = document.getElementById('status');
                if (statusText) {
                    this.uiController.setStatus(`Control capture: ${statusText}`);
                    this.uiController.setStatusError(false);
                } else if (status && status.textContent?.startsWith('Control capture:')) {
                    this.uiController.setStatus('');
                }
            },
        });
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

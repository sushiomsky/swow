const TOGGLE_SETTINGS_KEY = 77; // M
const ESCAPE_KEY = 27;
const PREVENT_DEFAULT_KEYS = new Set([37, 38, 39, 40, 32]);

export class MultiplayerInputController {
    constructor({
        controlSchemes,
        getControlScheme,
        onToggleSettings,
        onExitToMenu,
        isSettingsVisible
    }) {
        this.controlSchemes = controlSchemes;
        this.getControlScheme = getControlScheme;
        this.onToggleSettings = onToggleSettings;
        this.onExitToMenu = onExitToMenu;
        this.isSettingsVisible = isSettingsVisible;

        this.pressedKeys = {};
        this._boundKeyDown = null;
        this._boundKeyUp = null;
        this._boundBlur = null;
    }

    attach() {
        if (this._boundKeyDown) return;

        this._boundKeyDown = (event) => {
            this.pressedKeys[event.which] = true;

            if (event.which === TOGGLE_SETTINGS_KEY) {
                if (typeof this.onToggleSettings === 'function') this.onToggleSettings();
                event.preventDefault();
                return;
            }

            if (event.which === ESCAPE_KEY) {
                if (typeof this.isSettingsVisible === 'function' && this.isSettingsVisible()) {
                    if (typeof this.onToggleSettings === 'function') this.onToggleSettings(false);
                    event.preventDefault();
                    return;
                }
                if (typeof this.onExitToMenu === 'function') this.onExitToMenu();
            }

            if (PREVENT_DEFAULT_KEYS.has(event.which)) {
                event.preventDefault();
            }
        };

        this._boundKeyUp = (event) => {
            this.pressedKeys[event.which] = false;
        };

        this._boundBlur = () => {
            this.pressedKeys = {};
        };

        document.addEventListener('keydown', this._boundKeyDown);
        document.addEventListener('keyup', this._boundKeyUp);
        window.addEventListener('blur', this._boundBlur);
    }

    detach() {
        if (!this._boundKeyDown) return;
        document.removeEventListener('keydown', this._boundKeyDown);
        document.removeEventListener('keyup', this._boundKeyUp);
        window.removeEventListener('blur', this._boundBlur);
        this._boundKeyDown = null;
        this._boundKeyUp = null;
        this._boundBlur = null;
    }

    getControls() {
        const activeControlScheme = this.getControlScheme();
        const scheme = this.controlSchemes[activeControlScheme] || this.controlSchemes.arrows;
        const keys = scheme.keys;
        return {
            up: !!this.pressedKeys[keys.up],
            down: !!this.pressedKeys[keys.down],
            left: !!this.pressedKeys[keys.left],
            right: !!this.pressedKeys[keys.right],
            fire: !!this.pressedKeys[keys.fire],
        };
    }
}

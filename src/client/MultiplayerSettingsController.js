import { q } from '../utils.js';

export class MultiplayerSettingsController {
    constructor({
        controlSchemes,
        getOptions,
        onControlSchemeChange,
        onVisualFilterChange,
        onSoundChange
    }) {
        this.controlSchemes = controlSchemes;
        this.getOptions = getOptions;
        this.onControlSchemeChange = onControlSchemeChange;
        this.onVisualFilterChange = onVisualFilterChange;
        this.onSoundChange = onSoundChange;
    }

    init() {
        const toggler = q('settingsToggler');
        const controlsSelect = q('settingControls');
        const visualFilterSelect = q('settingVisualFilter');
        const soundSelect = q('settingSound');

        if (toggler) {
            toggler.onclick = () => {
                this.toggleVisibility();
            };
        }

        if (controlsSelect) {
            controlsSelect.onchange = (event) => {
                const value = event?.target?.value || 'arrows';
                if (typeof this.onControlSchemeChange === 'function') {
                    this.onControlSchemeChange(value);
                }
            };
        }

        if (visualFilterSelect) {
            visualFilterSelect.onchange = (event) => {
                const value = event?.target?.value || 'scanlines';
                if (typeof this.onVisualFilterChange === 'function') {
                    this.onVisualFilterChange(value);
                }
            };
        }

        if (soundSelect) {
            soundSelect.onchange = (event) => {
                const value = event?.target?.value || 'on';
                if (typeof this.onSoundChange === 'function') {
                    this.onSoundChange(value);
                }
            };
        }
    }

    isVisible() {
        const panel = q('settingsPanel');
        return panel ? !panel.classList.contains('hide') : false;
    }

    toggleVisibility(forceVisible) {
        const panel = q('settingsPanel');
        if (!panel) return;
        const show = typeof forceVisible === 'boolean' ? forceVisible : panel.classList.contains('hide');
        panel.classList.toggle('hide', !show);
    }

    syncUI() {
        const options = this.getOptions ? this.getOptions() : {};
        const controlsSelect = q('settingControls');
        const visualFilterSelect = q('settingVisualFilter');
        const soundSelect = q('settingSound');
        if (controlsSelect) controlsSelect.value = options.controlScheme || 'arrows';
        if (visualFilterSelect) visualFilterSelect.value = options.visualFilter || 'scanlines';
        if (soundSelect) soundSelect.value = options.sound || 'on';
    }

    updateControlsHint() {
        const options = this.getOptions ? this.getOptions() : {};
        const controlsHint = document.getElementById('controls-hint');
        if (!controlsHint) return;
        const scheme = this.controlSchemes[options.controlScheme] || this.controlSchemes.arrows;
        controlsHint.textContent = `${scheme.label} to move/shoot | M: settings | ESC: back to menu`;
    }
}

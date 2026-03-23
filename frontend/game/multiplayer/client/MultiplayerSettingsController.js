import { q } from '../../shared/utils.js';
import { describeControlBinding } from '../../shared/input/SharedControls.js';

export class MultiplayerSettingsController {
    constructor({
        getOptions,
        onControlBindingDeviceChange,
        onCaptureControlAction,
        onVisualFilterChange,
        onSoundChange,
        getControlBindingSummary,
        getControlActionSummary
    }) {
        this.getOptions = getOptions;
        this.onControlBindingDeviceChange = onControlBindingDeviceChange;
        this.onCaptureControlAction = onCaptureControlAction;
        this.onVisualFilterChange = onVisualFilterChange;
        this.onSoundChange = onSoundChange;
        this.getControlBindingSummary = getControlBindingSummary;
        this.getControlActionSummary = getControlActionSummary;
    }

    init() {
        const toggler = q('settingsToggler');
        const controlsSelect = q('settingControls');
        const controlsUpButton = q('settingControlUp');
        const controlsDownButton = q('settingControlDown');
        const controlsLeftButton = q('settingControlLeft');
        const controlsRightButton = q('settingControlRight');
        const controlsFireButton = q('settingControlFire');
        const visualFilterSelect = q('settingVisualFilter');
        const soundSelect = q('settingSound');

        if (toggler) {
            toggler.onclick = () => {
                this.toggleVisibility();
            };
        }

        if (controlsSelect) {
            controlsSelect.onchange = (event) => {
                const value = event?.target?.value || 'keyboard';
                if (typeof this.onControlBindingDeviceChange === 'function') {
                    this.onControlBindingDeviceChange(value);
                }
                this.updateControlsHint();
            };
        }
        if (controlsUpButton) controlsUpButton.onclick = () => this._captureControlAction('up');
        if (controlsDownButton) controlsDownButton.onclick = () => this._captureControlAction('down');
        if (controlsLeftButton) controlsLeftButton.onclick = () => this._captureControlAction('left');
        if (controlsRightButton) controlsRightButton.onclick = () => this._captureControlAction('right');
        if (controlsFireButton) controlsFireButton.onclick = () => this._captureControlAction('fire');

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
        if (controlsSelect) controlsSelect.value = options.controlDevice || 'keyboard';
        if (visualFilterSelect) visualFilterSelect.value = options.visualFilter || 'scanlines';
        if (soundSelect) soundSelect.value = options.sound || 'on';
        this._syncControlButtons();
    }

    updateControlsHint() {
        const options = this.getOptions ? this.getOptions() : {};
        const controlsHint = document.getElementById('controls-hint');
        if (!controlsHint) return;
        const summary = typeof this.getControlBindingSummary === 'function'
            ? this.getControlBindingSummary()
            : describeControlBinding(options.controlBinding);
        controlsHint.textContent = `${summary} | M: settings | ESC: back to menu`;
    }

    _captureControlAction(action) {
        if (typeof this.onCaptureControlAction === 'function') this.onCaptureControlAction(action);
    }

    _syncControlButtons() {
        const upButton = q('settingControlUp');
        const downButton = q('settingControlDown');
        const leftButton = q('settingControlLeft');
        const rightButton = q('settingControlRight');
        const fireButton = q('settingControlFire');
        const summary = this.getControlActionSummary || (() => '');

        if (upButton) upButton.textContent = `UP: ${summary('up')}`;
        if (downButton) downButton.textContent = `DOWN: ${summary('down')}`;
        if (leftButton) leftButton.textContent = `LEFT: ${summary('left')}`;
        if (rightButton) rightButton.textContent = `RIGHT: ${summary('right')}`;
        if (fireButton) fireButton.textContent = `FIRE: ${summary('fire')}`;
    }
}

import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadSessionControllerClass() {
    const thisFile = fileURLToPath(import.meta.url);
    const repoRoot = path.resolve(path.dirname(thisFile), '..', '..');
    const sourcePath = path.join(repoRoot, 'frontend/game/multiplayer/client/MultiplayerSessionController.js');
    const source = await fs.readFile(sourcePath, 'utf8');
    const transformed = source.replace(
        'export class MultiplayerSessionController',
        'class MultiplayerSessionController'
    ) + '\n;globalThis.MultiplayerSessionController = MultiplayerSessionController;\n';
    const sandbox = { setTimeout, clearTimeout };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(transformed, sandbox, { filename: sourcePath });
    if (typeof sandbox.MultiplayerSessionController !== 'function') {
        throw new Error('Failed to load MultiplayerSessionController class for reconnect check.');
    }
    return sandbox.MultiplayerSessionController;
}

async function run() {
    const MultiplayerSessionController = await loadSessionControllerClass();
    const statuses = [];
    const connectCalls = [];
    const socketClient = {
        isOpenOrConnecting() { return false; },
        connect(joinType, payload) {
            connectCalls.push({ joinType, payload });
            return true;
        },
        disconnect() {},
    };

    const uiController = {
        setButtonState() {},
        toggleRetry() {},
        setStatus(msg) { statuses.push(msg); },
        setStatusError() {},
        showOverlay() {},
        hideGameSurface() {},
    };

    const controller = new MultiplayerSessionController({
        uiController,
        audio: { stopAll() {} },
        getSocketClient: () => socketClient,
        onResetState() {},
        reconnectBaseDelayMs: 10,
        reconnectMaxAttempts: 2,
    });

    controller.connect('join_sitngo_br', { room: 'abc' });
    controller.setHasJoinedGame(true);
    controller.handleSocketClose();
    await wait(25);
    controller.handleSocketClose();
    await wait(25);
    controller.handleSocketOpen();
    controller.handleSocketClose();
    await wait(15);

    assert(connectCalls.length >= 3, `Expected reconnect attempts after repeated closes, got ${connectCalls.length} connect calls`);
    assert(connectCalls[1].joinType === 'join_sitngo_br', 'Expected reconnect to reuse last join type');
    assert(statuses.some((s) => s.includes('Reconnecting in')), 'Expected reconnect status message');
    assert(statuses.some((s) => s.includes('attempt 2/2')), 'Expected second reconnect attempt status after repeated close');
    assert(statuses.some((s) => s.includes('attempt 1/2')), 'Expected attempt counter to reset after socket reopen');
    console.log('PASS: session reconnect backoff check passed.');
}

run();

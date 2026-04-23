import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SitNGoQueue } = require('../../frontend/game/multiplayer/server/SitNGoQueue.js');
const { TeamBRQueue } = require('../../frontend/game/multiplayer/server/TeamBRQueue.js');

function createMockGameServer() {
    let dungeonCounter = 0;
    const eventLog = [];
    return {
        eventLog,
        _createDungeon() {
            dungeonCounter += 1;
            return {
                id: `dungeon-${dungeonCounter}`,
                addPlayer() {},
                startGame() {},
            };
        },
        spawnBot() {},
        _send(ws, payload) {
            eventLog.push({ ws, type: payload?.type || 'unknown' });
        },
        _sendInit(conn) {
            eventLog.push({ ws: conn.ws, type: 'init' });
        },
    };
}

function createConn(id) {
    return { ws: { id: `ws-${id}`, readyState: 1 } };
}

function closeConn(conn) {
    if (conn?.ws) conn.ws.readyState = 3;
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function runWithMutedConsole(fn) {
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};
    try {
        return fn();
    } finally {
        console.log = originalLog;
        console.warn = originalWarn;
    }
}

function assertMatchStartingBeforeInit(eventLog, ws) {
    const wsEvents = eventLog.filter((entry) => entry.ws === ws).map((entry) => entry.type);
    const matchIdx = wsEvents.indexOf('match_starting');
    const initIdx = wsEvents.indexOf('init');
    assert(initIdx >= 0, `Expected init for ${ws}, got ${wsEvents.join(', ')}`);
    assert(matchIdx >= 0, `Expected match_starting for ${ws}, got ${wsEvents.join(', ')}`);
    assert(matchIdx < initIdx, `Expected match_starting before init for ${ws}, got ${wsEvents.join(', ')}`);
}

function assertNoMatchStarting(eventLog, ws) {
    const wsEvents = eventLog.filter((entry) => entry.ws === ws).map((entry) => entry.type);
    assert(wsEvents.includes('init'), `Expected init for ${ws}, got ${wsEvents.join(', ')}`);
    assert(!wsEvents.includes('match_starting'), `Did not expect match_starting for ${ws}, got ${wsEvents.join(', ')}`);
}

function runSitNGoCheck() {
    const gameServer = createMockGameServer();
    const queue = new SitNGoQueue(gameServer);
    const c1 = createConn('sit-1');
    const c2 = createConn('sit-2');
    queue.waitingPlayers.set('sit-1', { conn: c1, joinedAt: Date.now() });
    queue.waitingPlayers.set('sit-2', { conn: c2, joinedAt: Date.now() });
    queue._launchGame();
    assertMatchStartingBeforeInit(gameServer.eventLog, c1.ws);
    assertMatchStartingBeforeInit(gameServer.eventLog, c2.ws);
    const snapshot = queue.getSnapshot();
    assert(snapshot.metrics.launches === 1, `Expected sit-n-go launches=1, got ${snapshot.metrics.launches}`);
    assert(snapshot.metrics.players_launched === 2, `Expected sit-n-go players_launched=2, got ${snapshot.metrics.players_launched}`);
    assert(snapshot.metrics.launch_success_rate_pct === 100, `Expected sit-n-go success rate 100, got ${snapshot.metrics.launch_success_rate_pct}`);
}

function runTeamSitNGoCheck() {
    const gameServer = createMockGameServer();
    const queue = new TeamBRQueue(gameServer, 'team-sitngo');
    const c1 = createConn('team-1');
    const c2 = createConn('team-2');
    const c3 = createConn('team-3');
    const c4 = createConn('team-4');
    queue.waitingPlayers.set('team-1', { conn: c1, joinedAt: Date.now() });
    queue.waitingPlayers.set('team-2', { conn: c2, joinedAt: Date.now() });
    queue.waitingPlayers.set('team-3', { conn: c3, joinedAt: Date.now() });
    queue.waitingPlayers.set('team-4', { conn: c4, joinedAt: Date.now() });
    queue._launchTeamGame();
    assertMatchStartingBeforeInit(gameServer.eventLog, c1.ws);
    assertMatchStartingBeforeInit(gameServer.eventLog, c2.ws);
    assertMatchStartingBeforeInit(gameServer.eventLog, c3.ws);
    assertMatchStartingBeforeInit(gameServer.eventLog, c4.ws);
    const snapshot = queue.getSnapshot();
    assert(snapshot.metrics.launches === 1, `Expected team sit-n-go launches=1, got ${snapshot.metrics.launches}`);
    assert(snapshot.metrics.players_launched === 4, `Expected team sit-n-go players_launched=4, got ${snapshot.metrics.players_launched}`);
    assert(snapshot.metrics.launch_success_rate_pct === 100, `Expected team sit-n-go success rate 100, got ${snapshot.metrics.launch_success_rate_pct}`);
}

function runTeamEndlessCheck() {
    const gameServer = createMockGameServer();
    const queue = new TeamBRQueue(gameServer, 'team-endless');
    const c1 = createConn('endless-1');
    queue._createTeamInstant('endless-1', c1);
    assertNoMatchStarting(gameServer.eventLog, c1.ws);
}

function runSitNGoCountdownCancelCheck() {
    const gameServer = createMockGameServer();
    const queue = new SitNGoQueue(gameServer);
    const c1 = createConn('countdown-sit-1');
    const c2 = createConn('countdown-sit-2');

    queue.addPlayer('countdown-sit-1', c1);
    queue.addPlayer('countdown-sit-2', c2);
    assert(!!queue.countdownTimer, 'Expected sit-n-go countdown to start after reaching minimum players');

    queue.removePlayer('countdown-sit-2');
    assert(!queue.countdownTimer, 'Expected sit-n-go countdown to cancel when dropping below minimum');
}

function runTeamSitNGoCountdownCancelCheck() {
    const gameServer = createMockGameServer();
    const queue = new TeamBRQueue(gameServer, 'team-sitngo');
    const c1 = createConn('countdown-team-1');
    const c2 = createConn('countdown-team-2');
    const c3 = createConn('countdown-team-3');
    const c4 = createConn('countdown-team-4');

    queue.addPlayer('countdown-team-1', c1);
    queue.addPlayer('countdown-team-2', c2);
    queue.addPlayer('countdown-team-3', c3);
    queue.addPlayer('countdown-team-4', c4);
    assert(!!queue.countdownTimer, 'Expected team sit-n-go countdown to start after reaching minimum players');

    queue.removePlayer('countdown-team-4');
    assert(!queue.countdownTimer, 'Expected team sit-n-go countdown to cancel when dropping below minimum');
}

function runSitNGoDisconnectCleanupCheck() {
    const gameServer = createMockGameServer();
    const queue = new SitNGoQueue(gameServer);
    const keepConn = createConn('stay-sit-1');
    const dropConn = createConn('drop-sit-2');

    queue.addPlayer('stay-sit-1', keepConn);
    queue.addPlayer('drop-sit-2', dropConn);
    queue.removePlayer('drop-sit-2');

    const launched = queue.launchWithBots();
    assert(launched, 'Expected sit-n-go launchWithBots to launch remaining queued player');

    const droppedEvents = gameServer.eventLog.filter((entry) => entry.ws === dropConn.ws).map((entry) => entry.type);
    assert(!droppedEvents.includes('init'), 'Disconnected sit-n-go player should not receive init');
    assert(!droppedEvents.includes('match_starting'), 'Disconnected sit-n-go player should not receive match_starting');
}

function runDisconnectAfterMatchStartingCheck() {
    const gameServer = createMockGameServer();
    const queue = new SitNGoQueue(gameServer);
    const stayConn = createConn('disconnect-race-stay');
    const dropConn = createConn('disconnect-race-drop');
    queue.waitingPlayers.set('disconnect-race-stay', { conn: stayConn, joinedAt: Date.now() });
    queue.waitingPlayers.set('disconnect-race-drop', { conn: dropConn, joinedAt: Date.now() });

    const originalSend = gameServer._send.bind(gameServer);
    gameServer._send = (ws, payload) => {
        originalSend(ws, payload);
        if (payload?.type === 'match_starting' && ws === dropConn.ws) {
            closeConn(dropConn);
        }
    };

    queue._launchGame();
    const droppedEvents = gameServer.eventLog.filter((entry) => entry.ws === dropConn.ws).map((entry) => entry.type);
    assert(droppedEvents.includes('match_starting'), 'Expected disconnected-race player to receive match_starting first');
    assert(!droppedEvents.includes('init'), 'Expected disconnected-race player to not receive init after disconnect');
}

function runTeamSitNGoDisconnectCleanupCheck() {
    const gameServer = createMockGameServer();
    const queue = new TeamBRQueue(gameServer, 'team-sitngo');
    const c1 = createConn('stay-team-1');
    const c2 = createConn('stay-team-2');
    const c3 = createConn('stay-team-3');
    const c4 = createConn('drop-team-4');

    queue.addPlayer('stay-team-1', c1);
    queue.addPlayer('stay-team-2', c2);
    queue.addPlayer('stay-team-3', c3);
    queue.addPlayer('drop-team-4', c4);
    queue.removePlayer('drop-team-4');
    queue._launchTeamGame();

    const droppedEvents = gameServer.eventLog.filter((entry) => entry.ws === c4.ws).map((entry) => entry.type);
    assert(!droppedEvents.includes('init'), 'Disconnected team sit-n-go player should not receive init');
    assert(!droppedEvents.includes('match_starting'), 'Disconnected team sit-n-go player should not receive match_starting');
    const snapshot = queue.getSnapshot();
    assert(snapshot.metrics.launch_failures >= 1, `Expected team sit-n-go launch_failures >= 1, got ${snapshot.metrics.launch_failures}`);
}

runWithMutedConsole(() => {
    runSitNGoCheck();
    runTeamSitNGoCheck();
    runTeamEndlessCheck();
    runSitNGoCountdownCancelCheck();
    runTeamSitNGoCountdownCancelCheck();
    runSitNGoDisconnectCleanupCheck();
    runTeamSitNGoDisconnectCleanupCheck();
    runDisconnectAfterMatchStartingCheck();
});
console.log('PASS: match_starting event ordering checks passed.');

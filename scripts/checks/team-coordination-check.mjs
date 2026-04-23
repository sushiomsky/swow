import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { TeamBRQueue } = require('../../frontend/game/multiplayer/server/TeamBRQueue.js');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function createConn(id) {
    return { ws: { id: `ws-${id}`, readyState: 1 } };
}

function createMockGameServer() {
    const dungeons = [];
    const eventLog = [];
    let dungeonCounter = 0;
    return {
        dungeons,
        eventLog,
        _createDungeon() {
            dungeonCounter += 1;
            const dungeon = {
                id: `dungeon-${dungeonCounter}`,
                matchMode: null,
                players: [],
                addPlayer(player) {
                    this.players.push(player);
                },
                startGame() {},
            };
            dungeons.push(dungeon);
            return dungeon;
        },
        spawnBot() {},
        _send(ws, payload) {
            eventLog.push({ ws, type: payload?.type || 'unknown' });
        },
        _sendInit(conn, dungeon) {
            eventLog.push({ ws: conn.ws, type: 'init', dungeonId: dungeon.id });
        },
    };
}

function assertSingleMatchStartingBeforeInit(eventLog, ws) {
    const events = eventLog.filter((entry) => entry.ws === ws).map((entry) => entry.type);
    const matchEvents = events.filter((type) => type === 'match_starting');
    const initEvents = events.filter((type) => type === 'init');
    assert(matchEvents.length === 1, `Expected exactly 1 match_starting event, got ${matchEvents.length} (${events.join(', ')})`);
    assert(initEvents.length === 1, `Expected exactly 1 init event, got ${initEvents.length} (${events.join(', ')})`);
    assert(events.indexOf('match_starting') < events.indexOf('init'), `Expected match_starting before init (${events.join(', ')})`);
}

function runTeamSpawnParityCheck() {
    const gameServer = createMockGameServer();
    const queue = new TeamBRQueue(gameServer, 'team-sitngo');
    const players = ['a', 'b', 'c', 'd'];
    const connections = new Map(players.map((id) => [id, createConn(id)]));

    for (const id of players) {
        queue.waitingPlayers.set(id, { conn: connections.get(id), joinedAt: Date.now() });
    }
    queue._launchTeamGame();

    assert(gameServer.dungeons.length === 2, `Expected 2 team dungeons, got ${gameServer.dungeons.length}`);
    for (const dungeon of gameServer.dungeons) {
        assert(dungeon.players.length === 2, `Expected each dungeon to have 2 players, got ${dungeon.players.length}`);
        const slots = dungeon.players.map((p) => p.num).sort((a, b) => a - b);
        assert(slots[0] === 0 && slots[1] === 1, `Expected slot parity [0,1], got [${slots.join(',')}]`);
    }

    for (const id of players) {
        assertSingleMatchStartingBeforeInit(gameServer.eventLog, connections.get(id).ws);
    }
}

function runClientHudPartnerClarityCheck() {
    const source = fs.readFileSync('frontend/game/multiplayer/client/MultiplayerMessageEffectsController.js', 'utf8');
    assert(source.includes('Team BR • You:'), 'Expected team HUD context prefix "Team BR • You:"');
    assert(source.includes('Teammate:'), 'Expected team HUD context suffix "Teammate:"');
}

runTeamSpawnParityCheck();
runClientHudPartnerClarityCheck();
console.log('PASS: team coordination checks passed (spawn parity + partner clarity).');

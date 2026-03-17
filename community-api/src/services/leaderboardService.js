import { db } from '../db.js';
import { redis } from '../redis.js';
import { emitToAll } from '../realtime.js';
import { logError, logInfo } from '../logger.js';

const LEADERBOARD_RECOMPUTE_QUEUE = 'leaderboard:recompute:queue';
const LEADERBOARD_RECOMPUTE_PENDING_PREFIX = 'leaderboard:recompute:pending:';
const LEADERBOARD_RECOMPUTE_PENDING_TTL_SECONDS = 300;
const LEADERBOARD_WORKER_WAKE_KEY = '__leaderboard_worker_wake__';

function pendingKey(season) {
  return `${LEADERBOARD_RECOMPUTE_PENDING_PREFIX}${season}`;
}

let workerState = null;

export async function recomputeSeasonRanks(season) {
  await db.query(`
    WITH ranked AS (
      SELECT leaderboard_id, ROW_NUMBER() OVER (ORDER BY score DESC, updated_at ASC) AS new_rank
      FROM leaderboards
      WHERE season = $1
    )
    UPDATE leaderboards l
    SET rank = r.new_rank, updated_at = NOW()
    FROM ranked r
    WHERE l.leaderboard_id = r.leaderboard_id
  `, [season]);
}

export async function enqueueSeasonRecompute(season = 'current') {
  const normalizedSeason = (season || 'current').toString();
  const markerKey = pendingKey(normalizedSeason);

  const wasQueued = await redis.set(markerKey, '1', {
    NX: true,
    EX: LEADERBOARD_RECOMPUTE_PENDING_TTL_SECONDS
  });
  if (!wasQueued) return false;

  await redis.rPush(LEADERBOARD_RECOMPUTE_QUEUE, normalizedSeason);
  logInfo('leaderboard_recompute_enqueued', { season: normalizedSeason });
  return true;
}

async function processRecomputeJob(season) {
  try {
    await recomputeSeasonRanks(season);
    emitToAll('leaderboard_update', { season });
    logInfo('leaderboard_recompute_completed', { season });
  } catch (error) {
    logError('leaderboard_recompute_failed', error, { season });
  } finally {
    await redis.del(pendingKey(season));
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function startLeaderboardWorker() {
  if (workerState?.running) return;
  workerState = { running: true, loopPromise: null };
  const state = workerState;
  logInfo('leaderboard_worker_started');

  const loop = async () => {
    while (state.running) {
      try {
        const job = await redis.brPop(LEADERBOARD_RECOMPUTE_QUEUE, 1);
        if (!job) continue;
        if (job.element === LEADERBOARD_WORKER_WAKE_KEY) {
          if (!state.running) break;
          continue;
        }
        await processRecomputeJob(job.element);
      } catch (error) {
        if (!state.running) break;
        logError('leaderboard_worker_loop_error', error);
        await wait(500);
      }
    }
  };

  state.loopPromise = loop().catch((error) => {
    logError('leaderboard_worker_stopped_unexpectedly', error);
  }).finally(() => {
    if (workerState === state) {
      workerState = null;
    }
  });
}

export async function stopLeaderboardWorker() {
  if (!workerState?.running) return;
  const state = workerState;
  state.running = false;
  try {
    await redis.lPush(LEADERBOARD_RECOMPUTE_QUEUE, LEADERBOARD_WORKER_WAKE_KEY);
  } catch (error) {
    logError('leaderboard_worker_stop_signal_failed', error);
  }
  await state.loopPromise;
  logInfo('leaderboard_worker_stopped');
}

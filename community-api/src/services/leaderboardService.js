import { db } from '../db.js';

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

import { db } from '../db.js';

const PROFILE_SELECT = `user_id, username, display_name, avatar_url, bio, xp, level, achievements, currency, region, clan_id, last_active`;

export async function findProfileByUsername(username) {
  const { rows } = await db.query(
    `SELECT ${PROFILE_SELECT}
     FROM users WHERE username = $1`,
    [username]
  );
  return rows[0] || null;
}

export async function findProfileById(userId) {
  const { rows } = await db.query(
    `SELECT ${PROFILE_SELECT}
     FROM users WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

export async function updateProfile(userId, data) {
  const keys = Object.keys(data || {});
  const set = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  const values = [...keys.map((key) => data[key]), userId];
  const { rows } = await db.query(
    `UPDATE users SET ${set}, updated_at = NOW(), last_active = NOW()
     WHERE user_id = $${keys.length + 1}
     RETURNING ${PROFILE_SELECT}`,
    values
  );
  return rows[0] || null;
}

export async function listRecentMatches(userId, limit = 50) {
  const { rows } = await db.query(
    `SELECT match_id, mode, score, kills, deaths, result, created_at
     FROM match_results WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function getAchievements(userId) {
  const { rows } = await db.query(
    `SELECT achievements FROM users WHERE user_id = $1`,
    [userId]
  );
  return rows[0]?.achievements || [];
}

export async function listBadges(userId) {
  const { rows } = await db.query(
    `SELECT season, badge, created_at
     FROM seasonal_badges WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function getUserProgress(userId) {
  const { rows } = await db.query(
    `SELECT xp, achievements FROM users WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

export async function insertMatchResult({ userId, mode, score, kills, deaths, result }) {
  await db.query(
    `INSERT INTO match_results (user_id, mode, score, kills, deaths, result)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, mode, score, kills, deaths, result]
  );
}

export async function updateUserProgress({ userId, xp, level, achievements }) {
  const { rows } = await db.query(
    `UPDATE users
     SET xp = $1, level = $2, achievements = $3::jsonb, last_active = NOW(), updated_at = NOW()
     WHERE user_id = $4
     RETURNING user_id, username, display_name, xp, level, achievements`,
    [xp, level, JSON.stringify(achievements), userId]
  );
  return rows[0] || null;
}

export async function upsertLeaderboardScore({ userId, score, season }) {
  await db.query(
    `INSERT INTO leaderboards (user_id, score, season, rank)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (user_id, season)
     DO UPDATE SET score = GREATEST(leaderboards.score, EXCLUDED.score), updated_at = NOW()`,
    [userId, score, season]
  );
}

export async function addSeasonalBadge({ userId, season, badge }) {
  await db.query(
    `INSERT INTO seasonal_badges (user_id, season, badge)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, season, badge) DO NOTHING`,
    [userId, season, badge]
  );
}

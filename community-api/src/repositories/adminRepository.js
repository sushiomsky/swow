import { db } from '../db.js';

function buildUsersWhereClause({ q, role }) {
  const filters = [];
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    filters.push(`(username ILIKE $${params.length} OR display_name ILIKE $${params.length})`);
  }

  if (role) {
    params.push(role);
    filters.push(`role = $${params.length}`);
  }

  return {
    whereClause: filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '',
    params
  };
}

function buildChatReportWhereClause({ status }) {
  const filters = [];
  const params = [];

  if (status) {
    params.push(status);
    filters.push(`r.status = $${params.length}`);
  }

  return {
    whereClause: filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '',
    params
  };
}

export async function listUsers({ q, role, page, size }) {
  const { whereClause, params } = buildUsersWhereClause({ q, role });
  const offset = (page - 1) * size;

  const totalResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM users ${whereClause}`,
    params
  );

  const rowsResult = await db.query(
    `SELECT user_id, username, role, display_name, level, xp, region, muted_until, banned_until, last_active
     FROM users
     ${whereClause}
     ORDER BY last_active DESC NULLS LAST, username ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, size, offset]
  );

  return {
    total: Number(totalResult.rows[0]?.total || 0),
    rows: rowsResult.rows
  };
}

export async function muteUser(userId, hours) {
  await db.query(
    `UPDATE users SET muted_until = NOW() + ($2 || ' hours')::interval WHERE user_id = $1`,
    [userId, hours]
  );
}

export async function banUser(userId, days) {
  await db.query(
    `UPDATE users SET banned_until = NOW() + ($2 || ' days')::interval WHERE user_id = $1`,
    [userId, days]
  );
}

export async function listChatReports({ status, page, size }) {
  const { whereClause, params } = buildChatReportWhereClause({ status });
  const offset = (page - 1) * size;

  const totalResult = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM chat_reports r
     ${whereClause}`,
    params
  );

  const rowsResult = await db.query(
    `SELECT r.report_id, r.reason, r.status, r.created_at, m.message_id, m.content, m.room_type, m.room_id
     FROM chat_reports r
     JOIN chat_messages m ON m.message_id = r.message_id
     ${whereClause}
     ORDER BY r.created_at DESC, r.report_id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, size, offset]
  );

  return {
    total: Number(totalResult.rows[0]?.total || 0),
    rows: rowsResult.rows
  };
}

export async function resolveChatReport(reportId) {
  await db.query(
    `UPDATE chat_reports SET status = 'resolved', resolved_at = NOW() WHERE report_id = $1`,
    [reportId]
  );
}

export async function upsertLeaderboardScore({ userId, season, score }) {
  await db.query(
    `INSERT INTO leaderboards (user_id, score, season, rank)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (user_id, season)
     DO UPDATE SET score = $2, updated_at = NOW()`,
    [userId, score, season]
  );
}

export async function createChallengeEvent({ description, reward, season, startDate, endDate }) {
  const { rows } = await db.query(
    `INSERT INTO challenges (description, reward, season, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING challenge_id, description, reward, season, start_date, end_date`,
    [description, reward, season, startDate, endDate]
  );
  return rows[0];
}

export async function getAnalyticsSnapshot() {
  const [dau, wau, mau, topPlayers, matches] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS c FROM users WHERE last_active >= NOW() - INTERVAL '1 day'`),
    db.query(`SELECT COUNT(*)::int AS c FROM users WHERE last_active >= NOW() - INTERVAL '7 days'`),
    db.query(`SELECT COUNT(*)::int AS c FROM users WHERE last_active >= NOW() - INTERVAL '30 days'`),
    db.query(`SELECT username, xp, level FROM users ORDER BY xp DESC LIMIT 5`),
    db.query(`SELECT COUNT(*)::int AS c FROM match_results WHERE created_at >= NOW() - INTERVAL '7 days'`)
  ]);

  return {
    dau: dau.rows[0].c,
    wau: wau.rows[0].c,
    mau: mau.rows[0].c,
    weeklyMatches: matches.rows[0].c,
    topPlayers: topPlayers.rows
  };
}

export async function getSystemNow() {
  const { rows } = await db.query('SELECT NOW() AS now');
  return rows[0]?.now || null;
}

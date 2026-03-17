import { enqueueSeasonRecompute } from './leaderboardService.js';
import {
  banUser,
  createChallengeEvent,
  getAnalyticsSnapshot,
  getSystemNow,
  listChatReports,
  listUsers,
  muteUser,
  resolveChatReport,
  upsertLeaderboardScore
} from '../repositories/adminRepository.js';

function pagingMeta(page, size, total) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / size);
  return {
    page,
    size,
    total,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages
  };
}

export async function getPagedUsers(query) {
  const { total, rows } = await listUsers(query);
  return {
    ...pagingMeta(query.page, query.size, total),
    rows
  };
}

export async function muteUserForHours(userId, hours) {
  await muteUser(userId, hours);
}

export async function banUserForDays(userId, days) {
  await banUser(userId, days);
}

export async function getPagedChatReports(query) {
  const { total, rows } = await listChatReports(query);
  return {
    ...pagingMeta(query.page, query.size, total),
    rows
  };
}

export async function resolveChatReportById(reportId) {
  await resolveChatReport(reportId);
}

export async function adjustLeaderboardScore({ userId, season, score }) {
  await upsertLeaderboardScore({ userId, season, score });
  await enqueueSeasonRecompute(season);
}

export async function createChallenge(payload) {
  return createChallengeEvent({
    description: payload.description,
    reward: payload.reward,
    season: payload.season,
    startDate: payload.start_date,
    endDate: payload.end_date
  });
}

export function getAnalytics() {
  return getAnalyticsSnapshot();
}

export async function getSystemHealth() {
  const dbNow = await getSystemNow();
  return { ok: true, dbNow };
}

import { enqueueSeasonRecompute } from './leaderboardService.js';
import {
  addSeasonalBadge,
  findProfileById,
  findProfileByUsername,
  getAchievements,
  getUserProgress,
  insertMatchResult,
  listBadges,
  listRecentMatches,
  updateProfile,
  updateUserProgress,
  upsertLeaderboardScore
} from '../repositories/usersRepository.js';
import { logInfo } from '../logger.js';

function computeLevel(xp) {
  return Math.max(1, Math.floor(xp / 1000) + 1);
}

function mergeAchievement(current, key) {
  const next = Array.isArray(current) ? [...current] : [];
  if (!next.includes(key)) next.push(key);
  return next;
}

export function getProfileByUsername(username) {
  return findProfileByUsername(username);
}

export function getProfileById(userId) {
  return findProfileById(userId);
}

export function updateUserProfile(userId, data) {
  return updateProfile(userId, data);
}

export function getRecentMatchesByUser(userId) {
  return listRecentMatches(userId, 50);
}

export function getUserAchievements(userId) {
  return getAchievements(userId);
}

export function getUserBadges(userId) {
  return listBadges(userId);
}

export async function submitMatchResult(userId, payload) {
  const existingProgress = await getUserProgress(userId);
  if (!existingProgress) return null;

  const baseXp = Math.max(10, Math.floor(payload.score / 20));
  const victoryBonusXp = payload.result === 'win' ? 50 : 0;
  const xpGain = baseXp + victoryBonusXp;
  const nextXp = existingProgress.xp + xpGain;
  const nextLevel = computeLevel(nextXp);
  const didLevelUp = nextLevel > (existingProgress.level || 1);

  let achievements = existingProgress.achievements || [];
  if (payload.score >= 5000) achievements = mergeAchievement(achievements, 'high-score-5000');
  if (payload.kills >= 10) achievements = mergeAchievement(achievements, 'eliminator-10');
  if (payload.result === 'win') achievements = mergeAchievement(achievements, 'first-victory');

  await insertMatchResult({
    userId,
    mode: payload.mode,
    score: payload.score,
    kills: payload.kills,
    deaths: payload.deaths,
    result: payload.result
  });

  const updatedProfile = await updateUserProgress({
    userId,
    xp: nextXp,
    level: nextLevel,
    achievements
  });
  if (!updatedProfile) return null;

  await upsertLeaderboardScore({
    userId,
    score: payload.score,
    season: payload.season
  });

  await enqueueSeasonRecompute(payload.season);

  let seasonalBadgeAwarded = false;
  if (payload.score >= 10000) {
    await addSeasonalBadge({
      userId,
      season: payload.season,
      badge: 'score-10k'
    });
    seasonalBadgeAwarded = true;
  }

  const rewardsEvent = {
    userId,
    mode: payload.mode,
    season: payload.season,
    score: payload.score,
    result: payload.result,
    xp_awarded: xpGain,
    xp_breakdown: {
      base_xp: baseXp,
      victory_bonus_xp: victoryBonusXp
    },
    level_before: existingProgress.level || 1,
    level_after: nextLevel,
    level_up: didLevelUp,
    seasonal_badge_awarded: seasonalBadgeAwarded ? 'score-10k' : null
  };
  logInfo('post_match_rewards_awarded', rewardsEvent);

  return {
    profile: updatedProfile,
    xpGain,
    rewardsEvent
  };
}

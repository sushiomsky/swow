import { Router } from 'express';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidationError } from '../middleware/validation.js';
import { db } from '../db.js';
import { logInfo, logError } from '../logger.js';

const router = Router();

const FEEDBACK_TYPES = ['bug', 'feature', 'general'];
const LABEL_MAP = { bug: 'bug', feature: 'enhancement', general: 'feedback' };

const feedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  url: z.string().max(500).optional(),
  metadata: z.record(z.string()).optional(),
});

let octokit = null;
function getOctokit() {
  if (!config.githubToken) return null;
  if (!octokit) octokit = new Octokit({ auth: config.githubToken });
  return octokit;
}

/**
 * POST /feedback — Submit feedback (creates a GitHub issue)
 * Requires authentication. Rate-limited separately.
 */
router.post('/', requireAuth, async (req, res, next) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) return handleValidationError(res, parsed.error);

  const { type, title, description, url, metadata } = parsed.data;
  const userId = req.user.sub;

  try {
    // Look up username for the issue body
    const userRow = await db.query('SELECT username FROM users WHERE user_id = $1', [userId]);
    const username = userRow.rows[0]?.username || 'anonymous';

    const issueBody = [
      `**Type:** ${type}`,
      `**From:** ${username}`,
      url ? `**Page:** ${url}` : null,
      metadata ? `**Meta:** \`${JSON.stringify(metadata)}\`` : null,
      '',
      '---',
      '',
      description,
    ].filter(Boolean).join('\n');

    const labels = ['user-feedback', LABEL_MAP[type]].filter(Boolean);

    let issueUrl = null;
    let issueNumber = null;

    const kit = getOctokit();
    if (kit) {
      const [owner, repo] = config.githubRepo.split('/');
      const { data: issue } = await kit.issues.create({
        owner,
        repo,
        title: `[${type}] ${title}`,
        body: issueBody,
        labels,
      });
      issueUrl = issue.html_url;
      issueNumber = issue.number;
      logInfo('feedback_github_issue_created', { issueNumber, issueUrl, userId });
    } else {
      logInfo('feedback_received_no_github', { type, title, userId });
    }

    // Store locally regardless of GitHub availability
    await db.query(
      `INSERT INTO feedback (user_id, type, title, description, url, github_issue_url, github_issue_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, type, title, description, url || null, issueUrl, issueNumber]
    );

    return res.status(201).json({
      ok: true,
      issue_url: issueUrl,
      issue_number: issueNumber,
    });
  } catch (e) {
    logError('feedback_submit_error', { error: e.message, userId });
    return next(e);
  }
});

/**
 * GET /feedback — List own feedback submissions
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, type, title, description, github_issue_url, github_issue_number, created_at
       FROM feedback WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.sub]
    );
    return res.json({ feedback: rows });
  } catch (e) {
    return next(e);
  }
});

export default router;

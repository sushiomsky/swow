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
 *
 * Ehrlichkeit: Ohne konfiguriertes GITHUB_FEEDBACK_TOKEN wird kein
 * Fake-201 mit issue_url:null zurückgegeben, sondern 503 — die
 * GitHub-Weiterleitung ist dann sauber deaktiviert. Schlägt die
 * Issue-Erstellung trotz Token fehl, wird das Feedback lokal
 * gespeichert und mit 502 geantwortet (fail-loud statt Fake-Erfolg).
 */
router.post('/', requireAuth, async (req, res, next) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) return handleValidationError(res, parsed.error);

  const kit = getOctokit();
  if (!kit) {
    return res.status(503).json({
      error: 'Feedback service unavailable',
      code: 'feedback_unavailable',
      message: 'Feedback forwarding to GitHub is not configured.'
    });
  }

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

    try {
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
    } catch (e) {
      logError('feedback_github_create_failed', { error: e.message, userId });
      // Fail-loud: lokal speichern, aber ehrlich 502 statt Fake-201 ohne Issue.
      await db.query(
        `INSERT INTO feedback (user_id, type, title, description, url, github_issue_url, github_issue_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, type, title, description, url || null, null, null]
      );
      return res.status(502).json({
        error: 'Feedback stored but GitHub issue creation failed',
        code: 'feedback_github_failed'
      });
    }

    // Store locally alongside the created issue
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

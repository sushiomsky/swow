import { ZodError } from 'zod';

function formatPath(path) {
  if (!Array.isArray(path) || path.length === 0) return '$';
  return path.join('.');
}

export function formatValidationIssues(issues = []) {
  return issues.map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message,
    code: issue.code
  }));
}

export function handleValidationError(res, error) {
  if (!(error instanceof ZodError)) return false;
  res.status(400).json({
    error: 'Validation failed',
    details: formatValidationIssues(error.issues)
  });
  return true;
}

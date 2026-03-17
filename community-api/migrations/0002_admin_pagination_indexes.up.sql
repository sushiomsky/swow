CREATE INDEX IF NOT EXISTS idx_users_last_active_username
  ON users (last_active DESC, username ASC);

CREATE INDEX IF NOT EXISTS idx_users_role_last_active_username
  ON users (role, last_active DESC, username ASC);

CREATE INDEX IF NOT EXISTS idx_chat_reports_created_at_report_id
  ON chat_reports (created_at DESC, report_id DESC);

CREATE INDEX IF NOT EXISTS idx_chat_reports_status_created_at_report_id
  ON chat_reports (status, created_at DESC, report_id DESC);

DROP INDEX IF EXISTS idx_auth_action_tokens_user_purpose;
DROP INDEX IF EXISTS idx_auth_action_tokens_lookup;
DROP TABLE IF EXISTS auth_action_tokens;

DROP INDEX IF EXISTS idx_users_email_unique;

ALTER TABLE users
  DROP COLUMN IF EXISTS email_verified_at,
  DROP COLUMN IF EXISTS email;

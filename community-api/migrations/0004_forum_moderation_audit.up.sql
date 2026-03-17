CREATE TABLE IF NOT EXISTS forum_moderation_audit (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_thread_id UUID,
  target_post_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_moderation_audit_thread_created_at
  ON forum_moderation_audit (target_thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forum_moderation_audit_actor_created_at
  ON forum_moderation_audit (actor_user_id, created_at DESC);

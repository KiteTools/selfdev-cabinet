-- Фаза 4: подтвержденные события прогресса по связкам
CREATE TABLE IF NOT EXISTS link_progress_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_id UUID NOT NULL REFERENCES links_registry(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_ref_id TEXT,
  suggestion_id UUID REFERENCES link_match_suggestions(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_link_progress_events_user_link_created
  ON link_progress_events (user_id, link_id, created_at DESC);

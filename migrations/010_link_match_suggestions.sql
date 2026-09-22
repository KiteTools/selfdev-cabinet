-- Фаза 4: AI-предложения по матчингу связок
CREATE TABLE IF NOT EXISTS link_match_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_input_id UUID NOT NULL REFERENCES link_signal_inputs(id) ON DELETE CASCADE,
  suggested_link_id UUID REFERENCES links_registry(id) ON DELETE SET NULL,
  suggestion_type TEXT NOT NULL,
  confidence NUMERIC(4,3),
  rationale TEXT,
  extracted_payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_link_match_suggestions_user_status_created
  ON link_match_suggestions (user_id, status, created_at DESC);

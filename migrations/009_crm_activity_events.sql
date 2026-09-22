-- Фаза 4: события CRM / SendPulse для ретро и прогресса
CREATE TABLE IF NOT EXISTS crm_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source_ref_id TEXT NOT NULL,
  payload JSONB,
  value_text TEXT,
  value_number NUMERIC,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_activity_events_user_occurred
  ON crm_activity_events (user_id, occurred_at DESC);

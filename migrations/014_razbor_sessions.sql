-- Фаза 4+: история завершённых разборов из SendPulse / AI Agent
CREATE TABLE IF NOT EXISTS razbor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'completed',
  source TEXT NOT NULL DEFAULT 'sendpulse_ai_agent',
  summary_text TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_razbor_sessions_user_occurred
  ON razbor_sessions (user_id, occurred_at DESC, created_at DESC);

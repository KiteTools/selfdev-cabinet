-- Фаза 4: входящие сигналы для анализа прогресса по связкам
CREATE TABLE IF NOT EXISTS link_signal_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_ref_id TEXT NOT NULL,
  source_created_at TIMESTAMPTZ,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_link_signal_inputs_user_status_created
  ON link_signal_inputs (user_id, status, created_at DESC);

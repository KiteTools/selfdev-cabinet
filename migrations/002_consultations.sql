-- Фаза 2: консультации и результаты суммаризатора
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary_type TEXT NOT NULL DEFAULT 'one_on_one',
  summary_json JSONB,
  summary_text TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultations_user_created
  ON consultations (user_id, created_at DESC);

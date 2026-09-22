-- Фаза 4: ретро по периоду
CREATE TABLE IF NOT EXISTS retro_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  prompt_version TEXT,
  input_summary JSONB,
  retro_text TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_retro_reports_period CHECK (date_from <= date_to)
);

CREATE INDEX IF NOT EXISTS idx_retro_reports_user_created
  ON retro_reports (user_id, created_at DESC);

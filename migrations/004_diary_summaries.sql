-- Фаза 3.1: саммари дневников за период (храним только последнее на пользователя)
CREATE TABLE IF NOT EXISTS diary_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  summary_type TEXT NOT NULL DEFAULT 'diary_period',
  status TEXT NOT NULL DEFAULT 'processing',
  summary_text TEXT,
  summary_json JSONB,
  input_entries_count INT NOT NULL DEFAULT 0,
  input_chars INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_diary_summaries_period CHECK (date_from <= date_to)
);

CREATE INDEX IF NOT EXISTS idx_diary_summaries_user_updated
  ON diary_summaries (user_id, updated_at DESC);

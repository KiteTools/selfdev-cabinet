-- Фаза 3: дневник из SendPulse
CREATE TABLE IF NOT EXISTS diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'sendpulse_voice',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diary_entries_user_local_date
  ON diary_entries (user_id, local_date DESC, created_at DESC);

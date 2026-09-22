-- Фаза 4.1: raw-успехи из SendPulse для ретро по периоду
CREATE TABLE IF NOT EXISTS successes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  diary_entry_id UUID REFERENCES diary_entries(id) ON DELETE SET NULL,
  local_date DATE NOT NULL,
  text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'sendpulse_success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_successes_user_local_date
  ON successes (user_id, local_date DESC, created_at DESC);

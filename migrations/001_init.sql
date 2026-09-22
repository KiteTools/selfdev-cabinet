-- Личный кабинет — инициализация БД
-- Запускать вручную через psql или Netlify DB console

-- users: маппинг telegram → sendpulse
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT UNIQUE NOT NULL,
  sendpulse_contact_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- current_state: текущий снапшот переменных
CREATE TABLE IF NOT EXISTS current_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- versions: снапшоты (последние 5 на пользователя)
CREATE TABLE IF NOT EXISTS versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_versions_user_created
  ON versions (user_id, created_at DESC);

-- sp_token: кэш OAuth-токена SendPulse (ровно одна строка)
CREATE TABLE IF NOT EXISTS sp_token (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token TEXT,
  expires_at TIMESTAMPTZ
);

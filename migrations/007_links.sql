-- Фаза 4: реестр связок
CREATE TABLE IF NOT EXISTS links_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  slot_no SMALLINT,
  stimulus TEXT NOT NULL,
  reaction TEXT NOT NULL,
  old_belief TEXT NOT NULL,
  new_belief TEXT NOT NULL,
  new_actions TEXT NOT NULL,
  source_consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_links_slot CHECK (slot_no IS NULL OR (slot_no >= 1 AND slot_no <= 10))
);

CREATE INDEX IF NOT EXISTS idx_links_registry_user_status_updated
  ON links_registry (user_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_links_registry_active_slot
  ON links_registry (user_id, slot_no)
  WHERE status = 'active' AND slot_no IS NOT NULL;

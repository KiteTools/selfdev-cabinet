-- Фаза 4: документы разбора по пониманиям
CREATE TABLE IF NOT EXISTS understanding_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive',
  title TEXT NOT NULL,
  content_md TEXT NOT NULL,
  source_consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_understanding_docs_user_type_created
  ON understanding_docs (user_id, doc_type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_understanding_docs_active
  ON understanding_docs (user_id, doc_type)
  WHERE status = 'active';

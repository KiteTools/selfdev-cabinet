-- Phase 4 hardening: service audit + one suggestion per signal
CREATE TABLE IF NOT EXISTS service_request_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  sp_contact_id TEXT,
  remote_ip_hash TEXT,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_request_audit_scope_created
  ON service_request_audit (scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_request_audit_scope_contact_created
  ON service_request_audit (scope, sp_contact_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_request_audit_scope_ip_created
  ON service_request_audit (scope, remote_ip_hash, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_link_match_suggestions_signal_unique
  ON link_match_suggestions (signal_input_id);

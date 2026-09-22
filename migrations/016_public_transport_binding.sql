-- One provider contact cannot be attached to two different Telegram identities.
CREATE UNIQUE INDEX IF NOT EXISTS users_contact_binding_unique ON users (sendpulse_contact_id);
-- Atomic background claim prevents duplicate AI calls for the same job.
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

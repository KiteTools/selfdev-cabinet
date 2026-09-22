-- Добавление plaintext-результата для саммари дневников
ALTER TABLE diary_summaries
  ADD COLUMN IF NOT EXISTS summary_text TEXT;

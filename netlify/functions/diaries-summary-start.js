import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { parsePeriodInput } from './lib/diaries.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const period = parsePeriodInput(body.date_from, body.date_to, 90);
  if (period.error) {
    return jsonResponse(400, { error: period.error });
  }

  try {
    const stats = await query(
      `SELECT
         COUNT(*)::int AS total,
         COALESCE(SUM(char_length(text)), 0)::int AS input_chars
       FROM diary_entries
       WHERE user_id = $1
         AND local_date BETWEEN $2::date AND $3::date`,
      [user.user_id, period.dateFrom, period.dateTo]
    );

    const total = stats[0]?.total || 0;
    const inputChars = stats[0]?.input_chars || 0;
    if (total === 0) {
      return jsonResponse(409, { error: 'За выбранный период нет дневников' });
    }

    const rows = await query(
      `INSERT INTO diary_summaries (
         id,
         user_id,
         date_from,
         date_to,
         summary_type,
         status,
         summary_text,
         summary_json,
         input_entries_count,
         input_chars,
         error_message,
         created_at,
         updated_at
       ) VALUES (
         gen_random_uuid(),
         $1,
         $2::date,
         $3::date,
         'diary_period',
         'processing',
         NULL,
         NULL,
         $4,
         $5,
         NULL,
         now(),
         now()
       )
       ON CONFLICT (user_id) DO UPDATE SET
         id = gen_random_uuid(),
         date_from = EXCLUDED.date_from,
         date_to = EXCLUDED.date_to,
         summary_type = 'diary_period',
         status = 'processing',
         summary_text = NULL,
         summary_json = NULL,
         input_entries_count = EXCLUDED.input_entries_count,
         input_chars = EXCLUDED.input_chars,
         error_message = NULL,
         created_at = now(),
         updated_at = now()
       RETURNING id, created_at`,
      [user.user_id, period.dateFrom, period.dateTo, total, inputChars]
    );

    return jsonResponse(200, {
      ok: true,
      id: rows[0].id,
      created_at: rows[0].created_at,
      date_from: period.dateFrom,
      date_to: period.dateTo,
      input_entries_count: total,
      input_chars: inputChars,
    });
  } catch (err) {
    console.error('diaries-summary-start error:', err);
    return jsonResponse(500, { error: 'Не удалось создать задачу саммари' });
  }
};

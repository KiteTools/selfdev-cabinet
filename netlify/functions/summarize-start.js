import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';

const ALLOWED_SUMMARY_TYPES = new Set(['one_on_one', 'topics']);

async function checkRateLimit(userId) {
  const rows = await query(
    `SELECT COUNT(*)::int AS total
     FROM consultations
     WHERE user_id = $1
       AND created_at >= now() - interval '24 hours'`,
    [userId]
  );
  const total = rows[0]?.total || 0;
  const limit = 5;
  return { allowed: total < limit, total, limit };
}

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

  const summaryType = String(body.summary_type || 'one_on_one');
  if (!ALLOWED_SUMMARY_TYPES.has(summaryType)) {
    return jsonResponse(400, { error: 'Некорректный тип саммари' });
  }

  const rate = await checkRateLimit(user.user_id);
  if (!rate.allowed) {
    return jsonResponse(429, {
      error: `Лимит консультаций: ${rate.limit} за последние 24 часа`,
    });
  }

  const rows = await query(
    `INSERT INTO consultations (
       user_id, summary_type, status, summary_json, summary_text, error_message
     ) VALUES ($1, $2, 'processing', NULL, NULL, NULL)
     RETURNING id, created_at`,
    [user.user_id, summaryType]
  );

  return jsonResponse(200, {
    ok: true,
    id: rows[0].id,
    created_at: rows[0].created_at,
  });
};

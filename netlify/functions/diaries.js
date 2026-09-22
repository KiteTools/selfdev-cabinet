import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { clampLimit, parsePeriodInput } from './lib/diaries.js';

function getQueryParam(event, key) {
  if (event.queryStringParameters?.[key] !== undefined) {
    return event.queryStringParameters[key];
  }
  const params = new URLSearchParams(event.rawQuery || '');
  return params.get(key);
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const dateFromRaw = getQueryParam(event, 'date_from');
  const dateToRaw = getQueryParam(event, 'date_to');
  const period = parsePeriodInput(dateFromRaw, dateToRaw, 90);
  if (period.error) {
    return jsonResponse(400, { error: period.error });
  }

  const limit = clampLimit(getQueryParam(event, 'limit'), 100, 200);

  try {
    const rows = await query(
      `SELECT id, user_id, local_date, text, source, created_at
       FROM diary_entries
       WHERE user_id = $1
         AND local_date BETWEEN $2::date AND $3::date
       ORDER BY local_date DESC, created_at DESC
       LIMIT $4`,
      [user.user_id, period.dateFrom, period.dateTo, limit]
    );

    const totals = await query(
      `SELECT COUNT(*)::int AS total
       FROM diary_entries
       WHERE user_id = $1
         AND local_date BETWEEN $2::date AND $3::date`,
      [user.user_id, period.dateFrom, period.dateTo]
    );

    return jsonResponse(200, {
      items: rows,
      total: totals[0]?.total || 0,
      date_from: period.dateFrom,
      date_to: period.dateTo,
      total_days: period.totalDays,
    });
  } catch (err) {
    console.error('diaries list error:', err);
    return jsonResponse(500, { error: 'Не удалось загрузить дневники' });
  }
};

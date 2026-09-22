import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { getQueryParam, isValidUuid } from './lib/phase4.js';

function mapRow(row) {
  return {
    id: row.id,
    date_from: row.date_from,
    date_to: row.date_to,
    status: row.status,
    prompt_version: row.prompt_version,
    input_summary: row.input_summary,
    successes: row.successes || [],
    retro_text: row.retro_text,
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const id = String(getQueryParam(event, 'id') || '').trim();

  try {
    if (id) {
      if (!isValidUuid(id)) {
        return jsonResponse(400, { error: 'id required (uuid)' });
      }

      const rows = await query(
        `SELECT id, date_from, date_to, status, prompt_version, input_summary, retro_text,
                error_message, created_at, updated_at
         FROM retro_reports
         WHERE id = $1
           AND user_id = $2`,
        [id, user.user_id]
      );
      if (rows.length === 0) {
        return jsonResponse(404, { error: 'Ретро не найдено' });
      }
      const report = rows[0];
      const successes = await query(
        `SELECT id, local_date, text, source, created_at
         FROM successes
         WHERE user_id = $1
           AND local_date BETWEEN $2::date AND $3::date
         ORDER BY local_date DESC, created_at DESC`,
        [user.user_id, report.date_from, report.date_to]
      );
      return jsonResponse(200, mapRow({
        ...report,
        successes,
      }));
    }

    const rows = await query(
      `SELECT id, date_from, date_to, status, prompt_version, input_summary, retro_text,
              error_message, created_at, updated_at
       FROM retro_reports
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [user.user_id]
    );

    return jsonResponse(200, {
      items: rows.map(mapRow),
    });
  } catch (error) {
    console.error('retro-status error:', error);
    return jsonResponse(500, { error: 'Не удалось загрузить ретро' });
  }
};

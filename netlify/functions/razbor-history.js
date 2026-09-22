import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';

function mapRow(row) {
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    summary_text: row.summary_text,
    occurred_at: row.occurred_at,
    created_at: row.created_at,
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

  try {
    const rows = await query(
      `SELECT id, status, source, summary_text, occurred_at, created_at
       FROM razbor_sessions
       WHERE user_id = $1
       ORDER BY occurred_at DESC, created_at DESC
       LIMIT 30`,
      [user.user_id]
    );

    return jsonResponse(200, {
      items: rows.map(mapRow),
    });
  } catch (error) {
    console.error('razbor-history error:', error);
    return jsonResponse(500, { error: 'Не удалось загрузить историю разбора' });
  }
};

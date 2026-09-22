import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';

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

  const linkId = String(body.link_id || '').trim();
  const note = String(body.note || '').trim();

  if (!linkId) {
    return jsonResponse(400, { error: 'link_id required' });
  }

  try {
    const linkRows = await query(
      `SELECT id
       FROM links_registry
       WHERE id = $1
         AND user_id = $2`,
      [linkId, user.user_id]
    );
    if (linkRows.length === 0) {
      return jsonResponse(404, { error: 'Связка не найдена' });
    }

    const rows = await query(
      `INSERT INTO link_progress_events (
         user_id, link_id, source_type, source_ref_id, suggestion_id, note
       ) VALUES ($1, $2, 'manual', NULL, NULL, $3)
       RETURNING id, user_id, link_id, source_type, source_ref_id, suggestion_id, note, created_at`,
      [user.user_id, linkId, note || null]
    );

    return jsonResponse(200, {
      ok: true,
      item: rows[0],
    });
  } catch (error) {
    console.error('links-progress-event error:', error);
    return jsonResponse(500, { error: 'Не удалось зафиксировать прогресс' });
  }
};

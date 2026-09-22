import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';

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

  const status = String(getQueryParam(event, 'status') || 'pending').trim();
  const limit = Math.min(Math.max(Number(getQueryParam(event, 'limit') || 50), 1), 100);

  try {
    const rows = await query(
      `SELECT s.id, s.signal_input_id, s.suggested_link_id, s.suggestion_type, s.confidence, s.rationale,
              s.extracted_payload, s.status, s.created_at, s.resolved_at,
              i.source_type, i.source_ref_id, i.text AS signal_text,
              l.slot_no, l.stimulus, l.new_belief
       FROM link_match_suggestions s
       JOIN link_signal_inputs i ON i.id = s.signal_input_id
       LEFT JOIN links_registry l ON l.id = s.suggested_link_id
       WHERE s.user_id = $1
         AND ($2 = '' OR s.status = $2)
       ORDER BY s.created_at DESC
       LIMIT $3`,
      [user.user_id, status, limit]
    );

    return jsonResponse(200, { items: rows });
  } catch (error) {
    console.error('link-suggestions list error:', error);
    return jsonResponse(500, { error: 'Не удалось загрузить предложения' });
  }
};

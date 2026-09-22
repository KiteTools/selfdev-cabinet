import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { normalizeSummary, renderSummaryToMarkdown } from './lib/summarizer.js';

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

  const id = String(getQueryParam(event, 'id') || '').trim();

  if (!id) {
    const rows = await query(
      `SELECT id, status, summary_type, created_at, error_message
       FROM consultations
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [user.user_id]
    );
    return jsonResponse(200, { items: rows });
  }

  const rows = await query(
    `SELECT id, status, summary_type, summary_json, summary_text, error_message, created_at
     FROM consultations
     WHERE id = $1
       AND user_id = $2`,
    [id, user.user_id]
  );

  if (rows.length === 0) {
    return jsonResponse(404, { error: 'Консультация не найдена' });
  }

  const row = rows[0];
  const summaryJson = row.summary_json ? normalizeSummary(row.summary_json) : null;
  const summaryText = summaryJson
    ? renderSummaryToMarkdown(summaryJson, { summaryType: row.summary_type })
    : (row.summary_text || '');

  return jsonResponse(200, {
    id: row.id,
    status: row.status,
    summary_type: row.summary_type,
    summary_json: summaryJson,
    summary_text: summaryText,
    error_message: row.error_message,
    created_at: row.created_at,
  });
};

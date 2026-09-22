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

function mapSummaryRow(row) {
  const summaryJson = row.summary_json ? normalizeSummary(row.summary_json) : null;
  const summaryText = String(row.summary_text || '').trim();
  const renderedSummary = summaryText || (
    summaryJson
      ? renderSummaryToMarkdown(summaryJson, { summaryType: row.summary_type })
      : ''
  );
  return {
    id: row.id,
    status: row.status,
    summary_type: row.summary_type,
    date_from: row.date_from,
    date_to: row.date_to,
    summary_json: summaryJson,
    summary_text: renderedSummary,
    input_entries_count: row.input_entries_count,
    input_chars: row.input_chars,
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
      const rows = await query(
        `SELECT id, user_id, date_from, date_to, summary_type, status, summary_text, summary_json,
                input_entries_count, input_chars, error_message, created_at, updated_at
         FROM diary_summaries
         WHERE id = $1
           AND user_id = $2`,
        [id, user.user_id]
      );
      if (rows.length === 0) {
        return jsonResponse(404, { error: 'Саммари дневников не найдено' });
      }
      return jsonResponse(200, mapSummaryRow(rows[0]));
    }

    const latest = await query(
      `SELECT id, user_id, date_from, date_to, summary_type, status, summary_text, summary_json,
              input_entries_count, input_chars, error_message, created_at, updated_at
       FROM diary_summaries
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [user.user_id]
    );

    if (latest.length === 0) {
      return jsonResponse(200, { item: null });
    }

    return jsonResponse(200, { item: mapSummaryRow(latest[0]) });
  } catch (err) {
    console.error('diaries-summary-status error:', err);
    return jsonResponse(500, { error: 'Не удалось загрузить саммари дневников' });
  }
};

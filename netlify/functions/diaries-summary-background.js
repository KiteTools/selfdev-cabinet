import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { buildDiarySummaryInput } from './lib/diaries.js';
import { callOpenAiDiarySummaryText, safeErrorMessage } from './lib/summarizer.js';

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function getQueryParam(event, key) {
  if (event.queryStringParameters?.[key] !== undefined) {
    return event.queryStringParameters[key];
  }
  const params = new URLSearchParams(event.rawQuery || '');
  return params.get(key);
}

async function markFailed(summaryId, message) {
  await query(
    `UPDATE diary_summaries
     SET status = 'failed',
         summary_text = NULL,
         summary_json = NULL,
         error_message = $2,
         updated_at = now()
     WHERE id = $1`,
    [summaryId, message]
  );
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const summaryId = String(getQueryParam(event, 'id') || '').trim();
  if (!isValidUuid(summaryId)) {
    return jsonResponse(400, { error: 'id required (uuid)' });
  }

  try {
    const summaryRows = await query(
      `SELECT id, user_id, date_from, date_to, status
       FROM diary_summaries
       WHERE id = $1
         AND user_id = $2`,
      [summaryId, user.user_id]
    );
    if (summaryRows.length === 0) {
      return jsonResponse(404, { error: 'Саммари дневников не найдено' });
    }

    const summary = summaryRows[0];
    const entries = await query(
      `SELECT local_date, created_at, source, text
       FROM diary_entries
       WHERE user_id = $1
         AND local_date BETWEEN $2::date AND $3::date
       ORDER BY local_date ASC, created_at ASC`,
      [summary.user_id, summary.date_from, summary.date_to]
    );

    if (!entries.length) {
      const message = 'За выбранный период нет дневников';
      await markFailed(summaryId, message);
      return jsonResponse(409, { error: message, id: summaryId });
    }

    const maxChars = Number(process.env.DIARY_INPUT_MAX_CHARS || 30000);
    const inputData = buildDiarySummaryInput(entries, maxChars);
    if (!inputData.input) {
      const message = 'Не удалось подготовить входные данные дневников';
      await markFailed(summaryId, message);
      return jsonResponse(409, { error: message, id: summaryId });
    }

    const summaryText = await callOpenAiDiarySummaryText({
      input: inputData.input,
    });

    await query(
      `UPDATE diary_summaries
       SET status = 'completed',
           summary_text = $2,
           summary_json = NULL,
           input_entries_count = $3,
           input_chars = $4,
           error_message = NULL,
           updated_at = now()
       WHERE id = $1`,
      [summaryId, summaryText, inputData.entriesCount, inputData.totalChars]
    );

    return jsonResponse(200, { ok: true, id: summaryId });
  } catch (error) {
    const message = safeErrorMessage(error);
    console.error('diaries-summary-background error:', {
      summaryId,
      errorName: error?.name,
      errorMessage: error?.message,
    });
    await markFailed(summaryId, message);
    return jsonResponse(500, { error: message, id: summaryId });
  }
};

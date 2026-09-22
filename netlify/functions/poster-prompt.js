import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { generatePosterPrompts, normalizeSummary, renderSummaryToMarkdown, safeErrorMessage } from './lib/summarizer.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const consultationId = String(body.consultation_id || '').trim();
  let summaryText = String(body.summary_text || '').trim();
  let summaryJson = body.summary_json && typeof body.summary_json === 'object'
    ? normalizeSummary(body.summary_json)
    : null;
  let summaryType = String(body.summary_type || 'one_on_one').trim() || 'one_on_one';

  if (!summaryText && !summaryJson && !consultationId) {
    return jsonResponse(400, { error: 'consultation_id or summary_text or summary_json required' });
  }

  if (consultationId && !summaryJson && !summaryText) {
    try {
      const rows = await query(
        `SELECT status, summary_type, summary_json, summary_text
         FROM consultations
         WHERE id = $1
           AND user_id = $2`,
        [consultationId, user.user_id]
      );
      if (rows.length === 0) {
        return jsonResponse(404, { error: 'Консультация не найдена' });
      }
      if (rows[0].status !== 'completed') {
        return jsonResponse(409, { error: 'Саммари ещё не готово' });
      }
      summaryType = String(rows[0].summary_type || summaryType || 'one_on_one');
      if (rows[0].summary_json) {
        summaryJson = normalizeSummary(rows[0].summary_json);
      }
      if (summaryJson) {
        summaryText = renderSummaryToMarkdown(summaryJson, {
          summaryType,
        });
      } else {
        summaryText = String(rows[0].summary_text || '').trim();
      }
    } catch (error) {
      console.error('poster-prompt consultation fetch error', {
        errorName: error?.name,
        errorMessage: error?.message,
        consultationId,
        userId: user.user_id,
      });
      if (!summaryText && !summaryJson) {
        return jsonResponse(500, { error: safeErrorMessage(error) });
      }
    }
  }

  if (!summaryText && !summaryJson) {
    return jsonResponse(400, { error: 'Текст саммари пустой' });
  }

  try {
    const prompts = await generatePosterPrompts({
      summaryText,
      summaryJson,
      summaryType,
    });
    return jsonResponse(200, { prompts });
  } catch (error) {
    console.error('poster-prompt error', {
      errorName: error?.name,
      errorMessage: error?.message,
    });
    return jsonResponse(500, { error: safeErrorMessage(error) });
  }
};

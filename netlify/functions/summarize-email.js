import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { normalizeSummary, renderSummaryToMarkdown, sendEmail } from './lib/summarizer.js';

function isValidEmail(value) {
  return /.+@.+\..+/.test(String(value || ''));
}

function formatDateForSubject(dateValue) {
  const date = dateValue ? new Date(dateValue) : new Date();
  return date.toLocaleDateString('ru-RU');
}

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
  const email = String(body.email || '').trim();
  const customSummaryText = String(body.summary_text || '').trim();

  if (!consultationId) {
    return jsonResponse(400, { error: 'consultation_id required' });
  }
  if (!email || !isValidEmail(email)) {
    return jsonResponse(400, { error: 'Некорректный email' });
  }

  const rows = await query(
    `SELECT id, status, summary_type, summary_json, summary_text, created_at
     FROM consultations
     WHERE id = $1
       AND user_id = $2`,
    [consultationId, user.user_id]
  );
  if (rows.length === 0) {
    return jsonResponse(404, { error: 'Консультация не найдена' });
  }

  const consultation = rows[0];
  if (consultation.status !== 'completed') {
    return jsonResponse(409, { error: 'Саммари ещё не готово' });
  }

  let summaryText = customSummaryText;
  if (!summaryText) {
    if (consultation.summary_json) {
      summaryText = renderSummaryToMarkdown(normalizeSummary(consultation.summary_json), {
        summaryType: consultation.summary_type,
      });
    } else {
      summaryText = String(consultation.summary_text || '').trim();
    }
  }
  if (!summaryText) {
    return jsonResponse(409, { error: 'Текст саммари пустой' });
  }

  const subject = `Саммари консультации — ${formatDateForSubject(consultation.created_at)}`;

  try {
    await sendEmail({
      to: email,
      subject,
      body: summaryText,
    });
    return jsonResponse(200, { ok: true });
  } catch (error) {
    console.error('summarize-email error:', error);
    return jsonResponse(500, { error: 'Не удалось отправить email' });
  }
};

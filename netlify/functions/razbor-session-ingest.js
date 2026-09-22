import { jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { authorizeServiceRequest } from './lib/service-auth.js';
import { getUserBySendPulseContactId } from './lib/users.js';

function clampText(value, maxLength = 12000) {
  const str = String(value || '').trim();
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

function normalizeOccurredAt(value) {
  const raw = String(value || '').trim();
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const spContactId = String(body.sp_contact_id || '').trim();
  const auth = await authorizeServiceRequest(event, {
    scope: 'razbor_session_ingest',
    spContactId,
    maxRequests: 120,
  });
  if (!auth.ok) {
    return jsonResponse(auth.statusCode, { error: auth.error });
  }

  const status = String(body.status || 'completed').trim() || 'completed';
  const source = String(body.source || 'sendpulse_ai_agent').trim() || 'sendpulse_ai_agent';
  const summaryText = clampText(body.summary_text, 12000);
  const occurredAt = normalizeOccurredAt(body.occurred_at);

  if (!spContactId) {
    return jsonResponse(400, { error: 'sp_contact_id required' });
  }
  if (!summaryText) {
    return jsonResponse(400, { error: 'summary_text required' });
  }

  try {
    const user = await getUserBySendPulseContactId(spContactId);
    if (!user) {
      return jsonResponse(404, { error: 'User not found for contact_id' });
    }

    const rows = await query(
      `INSERT INTO razbor_sessions (
         user_id, status, source, summary_text, occurred_at
       ) VALUES ($1, $2, $3, $4, $5::timestamptz)
       RETURNING id, user_id, status, source, summary_text, occurred_at, created_at`,
      [user.id, status, source, summaryText, occurredAt]
    );

    return jsonResponse(200, {
      ok: true,
      item: rows[0],
    });
  } catch (error) {
    console.error('razbor-session-ingest error:', error);
    return jsonResponse(500, { error: 'Не удалось сохранить разбор' });
  }
};

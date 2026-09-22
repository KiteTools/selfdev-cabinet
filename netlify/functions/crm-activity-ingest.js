import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { CRM_ACTIVITY_TYPES } from './lib/phase4.js';
import { authorizeServiceRequest } from './lib/service-auth.js';
import { getUserById, getUserBySendPulseContactId } from './lib/users.js';

async function resolveUser(event, body) {
  const jwtUser = await authenticateRequest(event);
  if (jwtUser) {
    return { user: await getUserById(jwtUser.user_id), auth: null };
  }

  const auth = await authorizeServiceRequest(event, {
    scope: 'crm_activity_ingest',
    spContactId: body.sp_contact_id,
    maxRequests: 240,
  });
  if (!auth.ok) {
    return { user: null, auth };
  }

  return {
    user: await getUserBySendPulseContactId(body.sp_contact_id),
    auth,
  };
}

function normalizeOccurredAt(rawValue) {
  const date = rawValue ? new Date(rawValue) : new Date();
  return Number.isFinite(date.getTime()) ? date : null;
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

  const { user, auth } = await resolveUser(event, body);
  if (!user) {
    return jsonResponse(auth?.statusCode || 401, { error: auth?.error || 'Unauthorized' });
  }

  const eventType = String(body.event_type || 'other').trim();
  const sourceRefId = String(body.source_ref_id || '').trim();
  const valueText = String(body.value_text || '').trim();
  const valueNumber = body.value_number === null || body.value_number === undefined || body.value_number === ''
    ? null
    : Number(body.value_number);
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : null;
  const text = String(body.text || '').trim();
  const occurredAt = normalizeOccurredAt(body.occurred_at);

  if (!CRM_ACTIVITY_TYPES.has(eventType)) {
    return jsonResponse(400, { error: 'Некорректный event_type' });
  }
  if (!sourceRefId) {
    return jsonResponse(400, { error: 'source_ref_id required' });
  }
  if (!occurredAt) {
    return jsonResponse(400, { error: 'Некорректный occurred_at' });
  }
  if (valueNumber !== null && !Number.isFinite(valueNumber)) {
    return jsonResponse(400, { error: 'Некорректный value_number' });
  }

  try {
    const activityRows = await query(
      `INSERT INTO crm_activity_events (
         user_id, event_type, source_ref_id, payload, value_text, value_number, occurred_at
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       RETURNING id, user_id, event_type, source_ref_id, payload, value_text, value_number, occurred_at, created_at`,
      [
        user.id,
        eventType,
        sourceRefId,
        JSON.stringify(payload),
        valueText || null,
        valueNumber,
        occurredAt.toISOString(),
      ]
    );

    let signal = null;
    if (text) {
      try {
        const signalRows = await query(
          `INSERT INTO link_signal_inputs (
             user_id, source_type, source_ref_id, source_created_at, text, status
           ) VALUES ($1, 'crm_evening', $2, $3, $4, 'pending')
           RETURNING id, user_id, source_type, source_ref_id, source_created_at, text, status, created_at`,
          [user.id, sourceRefId, occurredAt.toISOString(), text]
        );
        signal = signalRows[0];
      } catch (signalError) {
        console.warn('crm-activity-ingest warning: failed to enqueue link signal input', {
          activity_id: activityRows[0]?.id,
          user_id: user.id,
          error: signalError?.message || String(signalError),
        });
      }
    }

    return jsonResponse(200, {
      ok: true,
      item: activityRows[0],
      signal,
    });
  } catch (error) {
    console.error('crm-activity-ingest error:', error);
    return jsonResponse(500, { error: 'Не удалось сохранить CRM-событие' });
  }
};

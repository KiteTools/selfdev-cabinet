import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { LINK_SIGNAL_SOURCE_TYPES } from './lib/phase4.js';
import { authorizeServiceRequest } from './lib/service-auth.js';
import { getUserById, getUserBySendPulseContactId } from './lib/users.js';

async function resolveUser(event, body) {
  const jwtUser = await authenticateRequest(event);
  if (jwtUser) {
    return { user: await getUserById(jwtUser.user_id), auth: null };
  }

  const auth = await authorizeServiceRequest(event, {
    scope: 'link_signals_ingest',
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

  const sourceType = String(body.source_type || 'manual').trim();
  const sourceRefId = String(body.source_ref_id || '').trim();
  const text = String(body.text || '').trim();
  const sourceCreatedAt = body.source_created_at ? new Date(body.source_created_at) : null;

  if (!LINK_SIGNAL_SOURCE_TYPES.has(sourceType)) {
    return jsonResponse(400, { error: 'Некорректный source_type' });
  }
  if (!sourceRefId) {
    return jsonResponse(400, { error: 'source_ref_id required' });
  }
  if (!text) {
    return jsonResponse(400, { error: 'text required' });
  }
  if (sourceCreatedAt && !Number.isFinite(sourceCreatedAt.getTime())) {
    return jsonResponse(400, { error: 'Некорректный source_created_at' });
  }

  try {
    const rows = await query(
      `INSERT INTO link_signal_inputs (
         user_id, source_type, source_ref_id, source_created_at, text, status
       ) VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, user_id, source_type, source_ref_id, source_created_at, text, status, created_at`,
      [user.id, sourceType, sourceRefId, sourceCreatedAt?.toISOString() || null, text]
    );

    return jsonResponse(200, {
      ok: true,
      item: rows[0],
    });
  } catch (error) {
    console.error('link-signals-ingest error:', error);
    return jsonResponse(500, { error: 'Не удалось сохранить сигнал' });
  }
};

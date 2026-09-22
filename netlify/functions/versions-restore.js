import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { syncVariables } from './lib/transport.js';
import { toSendPulse, normalizeDerivedState } from './lib/variables.js';
import { ensureFocusLinkRegistryEntry } from './lib/focus-link.js';
import { query } from './lib/db.js';
import { replaceCurrentState, upsertTodayVersion } from './lib/state.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  // Extract version_id from path: /api/versions-restore?version_id=...
  const params = new URLSearchParams(event.rawQuery || '');
  let versionId = params.get('version_id');

  // Also try body
  if (!versionId && event.body) {
    try {
      const body = JSON.parse(event.body);
      versionId = body.version_id;
    } catch {}
  }

  if (!versionId) {
    return jsonResponse(400, { error: 'version_id required' });
  }

  // Fetch the version
  const rows = await query(
    'SELECT data FROM versions WHERE id = $1 AND user_id = $2',
    [versionId, user.user_id]
  );

  if (rows.length === 0) {
    return jsonResponse(404, { error: 'Версия не найдена' });
  }

  let restoredData = normalizeDerivedState(rows[0].data || {});

  try {
    const focusSync = await ensureFocusLinkRegistryEntry({
      userId: user.user_id,
      currentState: restoredData,
      nextState: restoredData,
    });
    restoredData = normalizeDerivedState({
      ...restoredData,
      ...focusSync.stateChanges,
    });

    // Sync all variables to SendPulse (convert times from client tz to Lisbon)
    // Pass empty explicitKeys so manualOnly fields (cycle_day) are skipped
    const clientTz = restoredData.tz || null;
    const spVars = toSendPulse(restoredData, clientTz, new Set());
    const delivery = await syncVariables(user.sendpulse_contact_id, spVars);

    await replaceCurrentState(user.user_id, restoredData);
    await upsertTodayVersion(user.user_id, restoredData);

    return jsonResponse(200, { ok: true, data: restoredData, delivery });
  } catch (err) {
    console.error('versions-restore error:', err);
    if (err.status === 429) {
      return jsonResponse(503, { error: 'SendPulse временно недоступен' });
    }
    if (err.status && err.status >= 400 && err.status < 500) {
      return jsonResponse(err.status, {
        error: err.message || 'Ошибка восстановления',
        ...(err.data || {}),
      });
    }
    return jsonResponse(500, { error: 'Ошибка восстановления' });
  }
};

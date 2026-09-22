import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { syncVariables } from './lib/transport.js';
import { getCurrentState, mergeCurrentState, upsertTodayVersion } from './lib/state.js';
import { serializeLinkForVariable } from './lib/phase4.js';
import { toSendPulse } from './lib/variables.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const id = String(body.id || '').trim();
  if (!id) {
    return jsonResponse(400, { error: 'id required' });
  }

  try {
    const rows = await query(
      `SELECT id, status, stimulus, reaction, old_belief, new_belief, new_actions
       FROM links_registry
       WHERE id = $1
         AND user_id = $2`,
      [id, user.user_id]
    );
    if (rows.length === 0) {
      return jsonResponse(404, { error: 'Связка не найдена' });
    }
    if (rows[0].status !== 'active') {
      return jsonResponse(409, { error: 'Сделать связкой в фокусе можно только рабочую связку' });
    }

    const currentState = await getCurrentState(user.user_id);
    const linkText = serializeLinkForVariable(rows[0]);
    const currentPublishedId = String(currentState.published_link_id || '').trim();
    const currentLinkText = String(currentState.link_main || currentState.gpt_situation || '').trim();
    const currentProgress = Number(currentState.published_link_progress || 0);
    const shouldResetProgress = currentPublishedId !== id || currentLinkText !== linkText;
    const changes = {
      link_main: linkText,
      gpt_situation: linkText,
      published_link_id: id,
      published_link_progress: shouldResetProgress
        ? 0
        : (Number.isFinite(currentProgress) && currentProgress >= 0 ? Math.floor(currentProgress) : 0),
    };

    const clientTz = currentState.tz || null;
    const spVars = toSendPulse(changes, clientTz, new Set(Object.keys(changes)));
    const delivery = await syncVariables(user.sendpulse_contact_id, spVars);

    const fullState = await mergeCurrentState(user.user_id, changes);
    await upsertTodayVersion(user.user_id, fullState);

    return jsonResponse(200, {
      ok: true,
      link_text: linkText,
      delivery,
      data: fullState,
    });
  } catch (error) {
    console.error('links-publish error:', error);
    if (error?.status === 429) {
      return jsonResponse(503, { error: 'SendPulse временно недоступен' });
    }
    return jsonResponse(500, { error: 'Не удалось обновить переменную' });
  }
};

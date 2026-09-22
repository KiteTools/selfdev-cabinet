import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { syncVariables } from './lib/transport.js';
import {
  validateChanges,
  toSendPulse,
  CRITICAL_FIELDS,
  VARIABLE_MAP,
  deriveStateChanges,
  normalizeDerivedState,
} from './lib/variables.js';
import { ensureFocusLinkRegistryEntry } from './lib/focus-link.js';
import { getCurrentState, mergeCurrentState, upsertTodayVersion } from './lib/state.js';

function shouldSyncFocusLink(currentState, nextState, normalizedChanges) {
  const nextText = String(nextState?.gpt_situation ?? nextState?.link_main ?? '').trim();
  const nextPublishedId = String(nextState?.published_link_id || '').trim();
  const changedFocusText =
    Object.prototype.hasOwnProperty.call(normalizedChanges, 'gpt_situation')
    || Object.prototype.hasOwnProperty.call(normalizedChanges, 'link_main');

  return (
    changedFocusText
    || (nextText && !nextPublishedId)
    || (!nextText && String(currentState?.published_link_id || '').trim())
  );
}

export function createStatePatchHandler({ authenticate = authenticateRequest, sync = syncVariables, readState = getCurrentState, mergeState = mergeCurrentState, saveVersion = upsertTodayVersion, ensureFocus = ensureFocusLinkRegistryEntry } = {}) {
return async (event) => {
  if (event.httpMethod !== 'PATCH') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticate(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const { changes } = body;
  if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) {
    return jsonResponse(400, { error: 'No changes provided' });
  }

  // Filter out unknown keys
  const knownChanges = {};
  for (const [key, value] of Object.entries(changes)) {
    if (VARIABLE_MAP[key]) knownChanges[key] = value;
  }

  if (Object.keys(knownChanges).length === 0) {
    return jsonResponse(400, { error: 'No valid fields' });
  }

  const currentState = await readState(user.user_id);
  let normalizedChanges = deriveStateChanges(currentState, knownChanges);

  // Validate
  const { valid, errors } = validateChanges(normalizedChanges);
  if (!valid) {
    return jsonResponse(422, { error: 'Validation failed', errors });
  }

  let mergedState = normalizeDerivedState({ ...currentState, ...normalizedChanges });

  for (const field of CRITICAL_FIELDS) {
    const val = mergedState[field];
    if (!val || val === '') {
      return jsonResponse(422, {
        error: 'Critical field missing',
        errors: { [field]: `${VARIABLE_MAP[field].label} обязательно` },
      });
    }
  }

  try {
    if (shouldSyncFocusLink(currentState, mergedState, normalizedChanges)) {
      const focusSync = await ensureFocus({
        userId: user.user_id,
        currentState,
        nextState: mergedState,
      });
      normalizedChanges = {
        ...normalizedChanges,
        ...focusSync.stateChanges,
      };
      mergedState = normalizeDerivedState({ ...currentState, ...normalizedChanges });
    }

    // If timezone changed, force re-sync t1/t2 even if they weren't in the changes
    const clientTz = mergedState.tz || null;
    const changesToSync = { ...normalizedChanges };
    if (normalizedChanges.tz && !normalizedChanges.t1 && mergedState.t1) {
      changesToSync.t1 = mergedState.t1;
    }
    if (normalizedChanges.tz && !normalizedChanges.t2 && mergedState.t2) {
      changesToSync.t2 = mergedState.t2;
    }

    // Sync to SendPulse (convert times from client tz to Lisbon)
    // explicitKeys = keys the user actually changed (for manualOnly filtering)
    const explicitKeys = new Set(Object.keys(normalizedChanges));
    const spChanges = toSendPulse(changesToSync, clientTz, explicitKeys);
    const delivery = await sync(user.sendpulse_contact_id, spChanges);

    const fullState = await mergeState(user.user_id, normalizedChanges);
    await saveVersion(user.user_id, fullState);

    return jsonResponse(200, { ok: true, data: fullState, delivery });
  } catch (err) {
    console.error('state-patch error:', err);
    if (err.status === 429) {
      return jsonResponse(503, { error: 'SendPulse временно недоступен' });
    }
    if (err.status && err.status >= 400 && err.status < 500) {
      return jsonResponse(err.status, {
        error: err.message || 'Ошибка сохранения',
        ...(err.data || {}),
      });
    }
    return jsonResponse(500, { error: err.message || 'Ошибка сохранения' });
  }
};

}
export const handler = createStatePatchHandler();

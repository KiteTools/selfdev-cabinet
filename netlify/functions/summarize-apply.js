import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { syncVariables } from './lib/transport.js';
import {
  validateChanges,
  toSendPulse,
  CRITICAL_FIELDS,
  VARIABLE_MAP,
  RAZBOR_FALSE_KEYS,
  RAZBOR_NEW_KEYS,
  appendTextToSlotFields,
  deriveStateChanges,
  normalizeDerivedState,
} from './lib/variables.js';
import { ensureFocusLinkRegistryEntry } from './lib/focus-link.js';
import { getCurrentState, mergeCurrentState, upsertTodayVersion } from './lib/state.js';
import { addSummaryApplyCycleReset } from './lib/summary-apply.js';
import { mapSummaryToVariables, SUMMARY_APPLY_GROUPS, normalizeSummary } from './lib/summarizer.js';

function serializeValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function buildGroups(changes, diffKeys) {
  const changedSet = new Set(diffKeys);
  return SUMMARY_APPLY_GROUPS.map((group) => {
    const fields = group.fields.filter((key) => Object.prototype.hasOwnProperty.call(changes, key));
    const changedFields = fields.filter((key) => changedSet.has(key));
    return {
      id: group.id,
      label: group.label,
      fields,
      changed_fields: changedFields,
      changed_count: changedFields.length,
    };
  }).filter((group) => group.fields.length > 0);
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
  const selectedFields = Array.isArray(body.selected_fields) ? body.selected_fields : null;
  const preview = Boolean(body.preview);

  if (!consultationId) {
    return jsonResponse(400, { error: 'consultation_id required' });
  }

  const rows = await query(
    `SELECT summary_json, status
     FROM consultations
     WHERE id = $1
       AND user_id = $2`,
    [consultationId, user.user_id]
  );
  if (rows.length === 0) {
    return jsonResponse(404, { error: 'Консультация не найдена' });
  }

  const consultation = rows[0];
  if (consultation.status !== 'completed' || !consultation.summary_json) {
    return jsonResponse(409, { error: 'Саммари ещё не готово' });
  }

  const changes = mapSummaryToVariables(consultation.summary_json, selectedFields);
  const normalizedSummary = normalizeSummary(consultation.summary_json);
  const currentState = await getCurrentState(user.user_id);

  const diff = Object.entries(changes).map(([key, value]) => ({
    key,
    label: VARIABLE_MAP[key]?.label || key,
    old_value: serializeValue(currentState[key]),
    new_value: serializeValue(value),
    changed: serializeValue(currentState[key]) !== serializeValue(value),
  }));
  const changedFields = diff.filter((item) => item.changed).map((item) => item.key);
  const groups = buildGroups(changes, changedFields);

  if (preview) {
    return jsonResponse(200, {
      ok: true,
      preview: {
        total_fields: Object.keys(changes).length,
        changed_fields: changedFields,
        groups,
        diff,
      },
    });
  }

  let applyChanges = {};
  for (const key of changedFields) {
    applyChanges[key] = changes[key];
  }

  const razborFalseText = normalizedSummary.false_beliefs.filter(Boolean).join('\n');
  const razborNewText = normalizedSummary.new_understandings.filter(Boolean).join('\n');
  const slotChanges = {
    ...appendTextToSlotFields(currentState, RAZBOR_FALSE_KEYS, razborFalseText),
    ...appendTextToSlotFields(currentState, RAZBOR_NEW_KEYS, razborNewText),
  };
  for (const [key, value] of Object.entries(slotChanges)) {
    if (serializeValue(currentState[key]) !== serializeValue(value)) {
      applyChanges[key] = value;
    }
  }

  applyChanges = addSummaryApplyCycleReset(applyChanges, currentState);

  if (Object.keys(applyChanges).length === 0) {
    return jsonResponse(200, {
      ok: true,
      data: currentState,
      applied_fields: [],
      message: 'Изменений для применения нет',
    });
  }

  const normalizedChanges = deriveStateChanges(currentState, applyChanges);
  const { valid, errors } = validateChanges(normalizedChanges);
  if (!valid) {
    return jsonResponse(422, {
      error: 'Validation failed',
      errors,
    });
  }

  let nextChanges = { ...normalizedChanges };
  let mergedState = normalizeDerivedState({ ...currentState, ...nextChanges });
  for (const field of CRITICAL_FIELDS) {
    const val = mergedState[field];
    if (val === null || val === undefined || val === '') {
      return jsonResponse(422, {
        error: 'Critical field missing',
        errors: { [field]: `${VARIABLE_MAP[field].label} обязательно` },
      });
    }
  }

  try {
    if (String(mergedState.gpt_situation ?? mergedState.link_main ?? '').trim()) {
      const focusSync = await ensureFocusLinkRegistryEntry({
        userId: user.user_id,
        currentState,
        nextState: mergedState,
      });
      nextChanges = {
        ...nextChanges,
        ...focusSync.stateChanges,
      };
      mergedState = normalizeDerivedState({ ...currentState, ...nextChanges });
    }

    const explicitKeys = new Set(Object.keys(applyChanges));
    const clientTz = mergedState.tz || null;
    const spVars = toSendPulse(nextChanges, clientTz, new Set(Object.keys(nextChanges)));
    const delivery = await syncVariables(user.sendpulse_contact_id, spVars);

    const fullState = await mergeCurrentState(user.user_id, nextChanges);
    await upsertTodayVersion(user.user_id, fullState);

    return jsonResponse(200, {
      ok: true,
      data: fullState,
      applied_fields: Object.keys(nextChanges),
      delivery,
    });
  } catch (err) {
    console.error('summarize-apply error:', err);
    if (err.status === 429) {
      return jsonResponse(503, { error: 'SendPulse временно недоступен' });
    }
    if (err.status && err.status >= 400 && err.status < 500) {
      return jsonResponse(err.status, {
        error: err.message || 'Ошибка применения саммари',
        ...(err.data || {}),
      });
    }
    return jsonResponse(500, { error: err.message || 'Ошибка применения саммари' });
  }
};

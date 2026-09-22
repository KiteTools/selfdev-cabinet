import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { mergeCurrentState } from './lib/state.js';
import {
  getFirstAvailableSlot,
  LINK_ACTIVE_LIMIT,
  normalizeLinkPayload,
} from './lib/phase4.js';

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

  const suggestionId = String(body.suggestion_id || '').trim();
  const action = String(body.action || '').trim();
  const note = String(body.note || '').trim();
  const activate = body.activate === true;

  if (!suggestionId) {
    return jsonResponse(400, { error: 'suggestion_id required' });
  }
  if (!['accept_progress', 'create_new_link', 'ignore'].includes(action)) {
    return jsonResponse(400, { error: 'Некорректный action' });
  }

  try {
    const rows = await query(
      `SELECT s.id, s.user_id, s.signal_input_id, s.suggested_link_id, s.suggestion_type, s.extracted_payload, s.status,
              i.source_type, i.source_ref_id, i.text AS signal_text
       FROM link_match_suggestions s
       JOIN link_signal_inputs i ON i.id = s.signal_input_id
       WHERE s.id = $1
         AND s.user_id = $2`,
      [suggestionId, user.user_id]
    );

    if (rows.length === 0) {
      return jsonResponse(404, { error: 'Предложение не найдено' });
    }

    const suggestion = rows[0];
    if (suggestion.status !== 'pending') {
      return jsonResponse(409, { error: 'Предложение уже обработано' });
    }

    if (action === 'ignore') {
      await query(
        `UPDATE link_match_suggestions
         SET status = 'rejected',
             resolved_at = now()
         WHERE id = $1`,
        [suggestionId]
      );
      await query(
        `UPDATE link_signal_inputs
         SET status = 'ignored'
         WHERE id = $1`,
        [suggestion.signal_input_id]
      );
      return jsonResponse(200, { ok: true });
    }

    if (action === 'accept_progress') {
      if (!suggestion.suggested_link_id) {
        return jsonResponse(409, { error: 'Для этого предложения нет подходящей связки' });
      }

      const eventRows = await query(
        `INSERT INTO link_progress_events (
           user_id, link_id, source_type, source_ref_id, suggestion_id, note
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, link_id, source_type, source_ref_id, suggestion_id, note, created_at`,
        [
          user.user_id,
          suggestion.suggested_link_id,
          suggestion.source_type,
          suggestion.source_ref_id,
          suggestionId,
          note || suggestion.extracted_payload?.note || null,
        ]
      );

      await query(
        `UPDATE link_match_suggestions
         SET status = 'accepted',
             resolved_at = now()
         WHERE id = $1`,
        [suggestionId]
      );

      return jsonResponse(200, {
        ok: true,
        progress_event: eventRows[0],
      });
    }

    const candidate = suggestion.extracted_payload?.candidate_link || {};
    const normalized = normalizeLinkPayload(candidate, { allowPartial: false });
    if (!normalized.valid) {
      return jsonResponse(409, {
        error: 'AI не сформировал полную новую связку',
        errors: normalized.errors,
      });
    }

    const activeLinks = await query(
      `SELECT id, slot_no
       FROM links_registry
       WHERE user_id = $1
         AND status = 'active'
       ORDER BY slot_no ASC NULLS LAST`,
      [user.user_id]
    );

    const status = activate && activeLinks.length < LINK_ACTIVE_LIMIT ? 'active' : 'inactive';
    const slotNo = status === 'active' ? getFirstAvailableSlot(activeLinks) : null;

    const createdLinks = await query(
      `INSERT INTO links_registry (
         user_id, status, slot_no, stimulus, reaction, old_belief, new_belief, new_actions, source_consultation_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
       RETURNING id, user_id, status, slot_no, stimulus, reaction, old_belief, new_belief, new_actions,
                 source_consultation_id, created_at, updated_at`,
      [
        user.user_id,
        status,
        slotNo,
        normalized.data.stimulus,
        normalized.data.reaction,
        normalized.data.old_belief,
        normalized.data.new_belief,
        normalized.data.new_actions,
      ]
    );

    if (status === 'active') {
      await mergeCurrentState(user.user_id, {
        published_link_progress: 0,
      });
    }

    await query(
      `UPDATE link_match_suggestions
       SET status = 'converted',
           resolved_at = now()
       WHERE id = $1`,
      [suggestionId]
    );

    return jsonResponse(200, {
      ok: true,
      item: createdLinks[0],
    });
  } catch (error) {
    console.error('link-suggestions-resolve error:', error);
    return jsonResponse(500, { error: 'Не удалось обработать предложение' });
  }
};

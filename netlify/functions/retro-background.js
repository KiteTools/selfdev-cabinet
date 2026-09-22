import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import {
  buildRetroInput,
  getQueryParam,
  isValidUuid,
  RETRO_PROMPT_VERSION,
  WEEKLY_RETRO_PROMPT,
} from './lib/phase4.js';
import { callOpenAiText, safeErrorMessage } from './lib/summarizer.js';

function resolveEnvKey(primary, fallback) {
  return process.env[primary] ? primary : fallback;
}

async function markFailed(retroId, message) {
  await query(
    `UPDATE retro_reports
     SET status = 'failed',
         retro_text = NULL,
         error_message = $2,
         updated_at = now()
     WHERE id = $1`,
    [retroId, message]
  );
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const retroId = String(getQueryParam(event, 'id') || '').trim();
  if (!isValidUuid(retroId)) {
    return jsonResponse(400, { error: 'id required (uuid)' });
  }

  try {
    const reportRows = await query(
      `SELECT id, user_id, date_from, date_to, status
       FROM retro_reports
       WHERE id = $1
         AND user_id = $2`,
      [retroId, user.user_id]
    );
    if (reportRows.length === 0) {
      return jsonResponse(404, { error: 'Ретро не найдено' });
    }

    const report = reportRows[0];
    const [diaries, razborSessions, newLinks, progressEvents, crmEvents] = await Promise.all([
      query(
        `SELECT id, local_date, text, source, created_at
         FROM diary_entries
         WHERE user_id = $1
           AND local_date BETWEEN $2::date AND $3::date
         ORDER BY local_date ASC, created_at ASC`,
        [user.user_id, report.date_from, report.date_to]
      ),
      query(
        `SELECT id, status, source, summary_text, occurred_at, created_at
         FROM razbor_sessions
         WHERE user_id = $1
           AND occurred_at::date BETWEEN $2::date AND $3::date
         ORDER BY occurred_at ASC, created_at ASC`,
        [user.user_id, report.date_from, report.date_to]
      ),
      query(
        `SELECT id, status, slot_no, stimulus, reaction, old_belief, new_belief, new_actions, created_at
         FROM links_registry
         WHERE user_id = $1
           AND created_at::date BETWEEN $2::date AND $3::date
         ORDER BY created_at ASC`,
        [user.user_id, report.date_from, report.date_to]
      ),
      query(
        `SELECT e.id, e.link_id, e.source_type, e.source_ref_id, e.note, e.created_at,
                l.slot_no, l.stimulus, l.reaction, l.old_belief, l.new_belief, l.new_actions
         FROM link_progress_events e
         JOIN links_registry l ON l.id = e.link_id
         WHERE e.user_id = $1
           AND e.created_at::date BETWEEN $2::date AND $3::date
         ORDER BY e.created_at ASC`,
        [user.user_id, report.date_from, report.date_to]
      ),
      query(
        `SELECT id, event_type, source_ref_id, payload, value_text, value_number, occurred_at, created_at
         FROM crm_activity_events
         WHERE user_id = $1
           AND occurred_at::date BETWEEN $2::date AND $3::date
         ORDER BY occurred_at ASC`,
        [user.user_id, report.date_from, report.date_to]
      ),
    ]);

    const retroInput = buildRetroInput({
      dateFrom: report.date_from,
      dateTo: report.date_to,
      diaries,
      razborSessions,
      newLinks,
      progressEvents,
      crmEvents,
    });

    const retroText = await callOpenAiText({
      instructions: WEEKLY_RETRO_PROMPT,
      input: retroInput.input,
      modelEnv: resolveEnvKey('OPENAI_RETRO_MODEL', 'OPENAI_MODEL'),
      maxTokensEnv: resolveEnvKey('OPENAI_RETRO_MAX_OUTPUT_TOKENS', 'OPENAI_MAX_OUTPUT_TOKENS'),
      timeoutEnv: resolveEnvKey('OPENAI_RETRO_TIMEOUT_MS', 'OPENAI_TIMEOUT_MS'),
    });

    await query(
      `UPDATE retro_reports
       SET status = 'completed',
           prompt_version = $2,
           input_summary = $3::jsonb,
           retro_text = $4,
           error_message = NULL,
           updated_at = now()
       WHERE id = $1`,
      [retroId, RETRO_PROMPT_VERSION, JSON.stringify(retroInput.input_summary), retroText]
    );

    return jsonResponse(200, { ok: true, id: retroId });
  } catch (error) {
    const message = safeErrorMessage(error);
    console.error('retro-background error:', error);
    await markFailed(retroId, message);
    return jsonResponse(500, { error: message, id: retroId });
  }
};

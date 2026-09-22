import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import {
  buildLinkMatchInput,
  getQueryParam,
  LINK_MATCH_PROMPT,
  normalizeLinkSuggestion,
  parseJsonFromText,
} from './lib/phase4.js';
import { authorizeServiceRequest } from './lib/service-auth.js';
import { callOpenAiText, safeErrorMessage } from './lib/summarizer.js';
import { getUserById, getUserBySendPulseContactId } from './lib/users.js';

function resolveEnvKey(primary, fallback) {
  return process.env[primary] ? primary : fallback;
}

async function resolveUser(event) {
  const jwtUser = await authenticateRequest(event);
  if (jwtUser) {
    return { user: await getUserById(jwtUser.user_id), auth: null };
  }

  const spContactId = String(getQueryParam(event, 'sp_contact_id') || '').trim();
  const auth = await authorizeServiceRequest(event, {
    scope: 'link_signals_process',
    spContactId,
    maxRequests: 30,
  });
  if (!auth.ok) {
    return { user: null, auth };
  }

  return {
    user: await getUserBySendPulseContactId(spContactId),
    auth,
  };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const { user, auth } = await resolveUser(event);
  if (!user) {
    return jsonResponse(auth?.statusCode || 401, { error: auth?.error || 'Unauthorized' });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {}

  const limit = Math.min(Math.max(Number(body.limit || 5), 1), 10);
  const signalInputId = String(body.signal_input_id || '').trim();

  try {
    const activeLinks = await query(
      `SELECT id, slot_no, stimulus, reaction, old_belief, new_belief, new_actions
       FROM links_registry
       WHERE user_id = $1
         AND status = 'active'
       ORDER BY slot_no ASC NULLS LAST, updated_at DESC`,
      [user.id]
    );

    await query(
      `UPDATE link_signal_inputs i
       SET status = CASE
         WHEN s.suggestion_type = 'ignore' THEN 'ignored'
         ELSE 'processed'
       END
       FROM link_match_suggestions s
       WHERE i.user_id = $1
         AND i.id = s.signal_input_id
         AND ($2 = '' OR i.id::text = $2)
         AND i.status IN ('pending', 'processing')`,
      [user.id, signalInputId]
    );

    const pendingSignals = await query(
      `WITH claimable AS (
         SELECT i.id
         FROM link_signal_inputs i
         WHERE i.user_id = $1
           AND i.status = 'pending'
           AND ($2 = '' OR i.id::text = $2)
           AND NOT EXISTS (
             SELECT 1
             FROM link_match_suggestions s
             WHERE s.signal_input_id = i.id
           )
         ORDER BY i.created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $3
       )
       UPDATE link_signal_inputs i
       SET status = 'processing'
       FROM claimable c
       WHERE i.id = c.id
       RETURNING i.id, i.user_id, i.source_type, i.source_ref_id, i.source_created_at, i.text, i.status, i.created_at`,
      [user.id, signalInputId, limit]
    );

    if (pendingSignals.length === 0) {
      return jsonResponse(200, { ok: true, items: [] });
    }

    const createdSuggestions = [];
    const failures = [];
    for (const signal of pendingSignals) {
      try {
        const aiText = await callOpenAiText({
          instructions: LINK_MATCH_PROMPT,
          input: buildLinkMatchInput(signal, activeLinks),
          modelEnv: resolveEnvKey('OPENAI_LINKS_MODEL', 'OPENAI_MODEL'),
          maxTokensEnv: resolveEnvKey('OPENAI_LINKS_MAX_OUTPUT_TOKENS', 'OPENAI_MAX_OUTPUT_TOKENS'),
          timeoutEnv: resolveEnvKey('OPENAI_LINKS_TIMEOUT_MS', 'OPENAI_TIMEOUT_MS'),
        });

        const normalized = normalizeLinkSuggestion(parseJsonFromText(aiText), activeLinks);
        const rows = await query(
          `INSERT INTO link_match_suggestions (
             user_id, signal_input_id, suggested_link_id, suggestion_type, confidence, rationale, extracted_payload, status
           ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending')
           RETURNING id, user_id, signal_input_id, suggested_link_id, suggestion_type, confidence, rationale,
                     extracted_payload, status, created_at, resolved_at`,
          [
            user.id,
            signal.id,
            normalized.suggested_link_id,
            normalized.suggestion_type,
            normalized.confidence,
            normalized.rationale || null,
            JSON.stringify(normalized.extracted_payload),
          ]
        );

        await query(
          `UPDATE link_signal_inputs
           SET status = $2
           WHERE id = $1`,
          [signal.id, normalized.suggestion_type === 'ignore' ? 'ignored' : 'processed']
        );

        createdSuggestions.push({
          ...rows[0],
          signal_text: signal.text,
        });
      } catch (signalError) {
        const message = safeErrorMessage(signalError);
        failures.push({
          signal_input_id: signal.id,
          error: message,
        });
        console.error('link-signals-process item error:', {
          signal_input_id: signal.id,
          error: signalError,
        });
        try {
          await query(
            `UPDATE link_signal_inputs
             SET status = 'pending'
             WHERE id = $1
               AND status = 'processing'
               AND NOT EXISTS (
                 SELECT 1
                 FROM link_match_suggestions s
                 WHERE s.signal_input_id = $1
               )`,
            [signal.id]
          );
        } catch (resetError) {
          console.error('link-signals-process reset error:', {
            signal_input_id: signal.id,
            error: resetError,
          });
        }
      }
    }

    if (createdSuggestions.length === 0 && failures.length > 0) {
      return jsonResponse(500, {
        error: failures[0].error,
        failures,
      });
    }

    return jsonResponse(200, {
      ok: failures.length === 0,
      items: createdSuggestions,
      failures,
    });
  } catch (error) {
    console.error('link-signals-process error:', error);
    return jsonResponse(500, { error: safeErrorMessage(error) });
  }
};

import { timingSafeEqual } from 'crypto';
import { jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { getCurrentState, mergeCurrentState } from './lib/state.js';
import { getUserBySendPulseContactId } from './lib/users.js';

const DEFAULT_SOURCE = 'sendpulse_voice';
const DEFAULT_TIMEZONE = process.env.BOT_TIMEZONE || 'UTC';
const ALLOWED_SOURCES = new Set([
  'sendpulse_voice',
  'sendpulse_success',
  'sendpulse_new',
  'sendpulse_idea',
]);
const PROGRESS_SOURCES = new Set([
  'sendpulse_success',
  'sendpulse_new',
  'sendpulse_idea',
]);

function extractHeader(event, key) {
  const headers = event.headers || {};
  return headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()] ?? '';
}

function extractProvidedSecret(event) {
  const signature = String(extractHeader(event, 'X-SP-Signature') || '').trim();
  if (signature) return signature;

  const authHeader = String(extractHeader(event, 'Authorization') || '').trim();
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i);
  return bearer ? bearer[1].trim() : '';
}

function safeEquals(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function normalizeTimezone(value) {
  const tz = String(value || '').trim();
  if (!tz) return DEFAULT_TIMEZONE;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function getLocalDate(tz, date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
      parts[part.type] = part.value;
    }
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const expectedSecret = String(process.env.SENDPULSE_DIARY_SECRET || '').trim();
  if (!expectedSecret) {
    console.error('diary error: SENDPULSE_DIARY_SECRET is not configured');
    return jsonResponse(500, { error: 'Service is not configured' });
  }

  const providedSecret = extractProvidedSecret(event);
  if (!providedSecret || !safeEquals(providedSecret, expectedSecret)) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const spContactId = String(body.sp_contact_id || '').trim();
  const diaryText = typeof body.diary_text === 'string' ? body.diary_text.trim() : '';
  const source = String(body.source || DEFAULT_SOURCE).trim() || DEFAULT_SOURCE;

  if (!spContactId) {
    return jsonResponse(400, { error: 'sp_contact_id is required' });
  }
  if (!diaryText) {
    return jsonResponse(400, { error: 'diary_text is required' });
  }
  if (!ALLOWED_SOURCES.has(source)) {
    return jsonResponse(400, { error: 'Unsupported source' });
  }

  try {
    const user = await getUserBySendPulseContactId(spContactId);
    if (!user) {
      return jsonResponse(404, { error: 'User not found for contact_id' });
    }

    const userId = user.id;
    const state = await getCurrentState(userId);
    const timezone = normalizeTimezone(state?.tz);
    const localDate = getLocalDate(timezone);

    const rows = await query(
      `INSERT INTO diary_entries (user_id, local_date, text, source)
       VALUES ($1, $2::date, $3, $4)
       RETURNING id, user_id, local_date, created_at`,
      [userId, localDate, diaryText, source]
    );

    const row = rows[0];

    if (source === 'sendpulse_success') {
      await query(
        `INSERT INTO successes (user_id, diary_entry_id, local_date, text, source)
         VALUES ($1, $2, $3::date, $4, $5)`,
        [userId, row.id, localDate, diaryText, source]
      );
    }

    try {
      await query(
        `INSERT INTO link_signal_inputs (
           user_id, source_type, source_ref_id, source_created_at, text, status
         ) VALUES ($1, 'diary_entry', $2, $3, $4, 'pending')`,
        [userId, row.id, row.created_at, diaryText]
      );
    } catch (signalError) {
      console.warn('diary warning: failed to enqueue link signal input', {
        diary_entry_id: row.id,
        user_id: userId,
        error: signalError?.message || String(signalError),
        });
    }

    const activeLinkText = String(state?.gpt_situation || state?.link_main || '').trim();
    if (PROGRESS_SOURCES.has(source) && activeLinkText) {
      const currentProgress = Number(state?.published_link_progress || 0);
      await mergeCurrentState(userId, {
        published_link_progress: Number.isFinite(currentProgress) && currentProgress >= 0
          ? currentProgress + 1
          : 1,
      });
    }

    return jsonResponse(200, {
      ok: true,
      id: row.id,
      user_id: row.user_id,
      local_date: row.local_date,
      created_at: row.created_at,
    });
  } catch (err) {
    console.error('diary error:', err);
    return jsonResponse(500, { error: 'Failed to save diary entry' });
  }
};

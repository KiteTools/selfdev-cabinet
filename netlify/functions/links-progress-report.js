import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { getCurrentState } from './lib/state.js';

const PERIODS = {
  '8w': 56,
  '12w': 84,
  '6m': 183,
};

function getQueryParam(event, key) {
  if (event.queryStringParameters?.[key] !== undefined) {
    return event.queryStringParameters[key];
  }
  const params = new URLSearchParams(event.rawQuery || '');
  return params.get(key);
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function toDateObject(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  const raw = String(value || '').trim();
  if (!raw) return new Date(Number.NaN);

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    return new Date(Number.NaN);
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function startOfWeekUtc(date) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay() || 7;
  result.setUTCDate(result.getUTCDate() - day + 1);
  return result;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const periodKey = String(getQueryParam(event, 'period') || '8w');
  const days = PERIODS[periodKey] || PERIODS['8w'];
  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const dateFromIso = toDateString(dateFrom);
  const dateToIso = toDateString(dateTo);

  try {
    const [links, progressEvents, newLinks, crmEvents, diarySignals, currentState] = await Promise.all([
      query(
        `SELECT id, slot_no, status, stimulus, reaction, old_belief, new_belief, new_actions
         FROM links_registry
         WHERE user_id = $1
         ORDER BY status, slot_no ASC NULLS LAST, updated_at DESC`,
        [user.user_id]
      ),
      query(
        `SELECT e.id, e.link_id, e.created_at, l.slot_no, l.new_belief, l.stimulus
         FROM link_progress_events e
         JOIN links_registry l ON l.id = e.link_id
         WHERE e.user_id = $1
           AND e.created_at >= $2
         ORDER BY e.created_at DESC`,
        [user.user_id, dateFrom.toISOString()]
      ),
      query(
        `SELECT id, slot_no, status, new_belief, stimulus, created_at
         FROM links_registry
         WHERE user_id = $1
           AND created_at >= $2
         ORDER BY created_at DESC`,
        [user.user_id, dateFrom.toISOString()]
      ),
      query(
        `SELECT event_type, occurred_at
         FROM crm_activity_events
         WHERE user_id = $1
           AND occurred_at >= $2
         ORDER BY occurred_at DESC`,
        [user.user_id, dateFrom.toISOString()]
      ),
      query(
        `SELECT TO_CHAR(local_date, 'YYYY-MM-DD') AS local_date, source
         FROM diary_entries
         WHERE user_id = $1
           AND local_date BETWEEN $2::date AND $3::date
           AND source IN ('sendpulse_success', 'sendpulse_new', 'sendpulse_idea')
         ORDER BY local_date DESC, created_at DESC`,
        [user.user_id, dateFromIso, dateToIso]
      ),
      getCurrentState(user.user_id),
    ]);

    const weeksMap = new Map();
    const cursor = startOfWeekUtc(dateFrom);
    const endWeek = startOfWeekUtc(dateTo);
    while (cursor.getTime() <= endWeek.getTime()) {
      const key = toDateString(cursor);
      weeksMap.set(key, {
        week_start: key,
        overall_progress: 0,
        successes: 0,
        new_links: 0,
        ideas: 0,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    const ensureWeek = (isoDate) => {
      const week = startOfWeekUtc(new Date(isoDate));
      const key = toDateString(week);
      if (!weeksMap.has(key)) {
        weeksMap.set(key, {
          week_start: key,
          overall_progress: 0,
          successes: 0,
          new_links: 0,
          ideas: 0,
        });
      }
      return weeksMap.get(key);
    };

    for (const linkRow of newLinks) {
      ensureWeek(linkRow.created_at).new_links += 1;
    }
    for (const diaryRow of diarySignals) {
      const bucket = ensureWeek(toDateObject(diaryRow.local_date));
      if (diaryRow.source === 'sendpulse_success') bucket.successes += 1;
      if (diaryRow.source === 'sendpulse_new') bucket.new_links += 1;
      if (diaryRow.source === 'sendpulse_idea') bucket.ideas += 1;
    }
    for (const crmRow of crmEvents) {
      const bucket = ensureWeek(crmRow.occurred_at);
      if (crmRow.event_type === 'task_done') bucket.successes += 1;
      if (crmRow.event_type === 'evening_plus') bucket.ideas += 1;
    }
    for (const bucket of weeksMap.values()) {
      bucket.overall_progress = bucket.successes + bucket.new_links + bucket.ideas;
    }

    const linkCounts = new Map();
    for (const link of links) {
      linkCounts.set(link.id, {
        id: link.id,
        slot_no: link.slot_no,
        status: link.status,
        title: link.new_belief || link.stimulus || 'Связка',
        progress_events: 0,
      });
    }
    for (const eventRow of progressEvents) {
      const item = linkCounts.get(eventRow.link_id);
      if (item) item.progress_events += 1;
    }

    const activeLinkId = String(currentState?.published_link_id || '').trim();
    const activeLinkRow = activeLinkId
      ? links.find((item) => String(item.id) === activeLinkId) || null
      : null;
    const activeLinkText = String(currentState?.link_main || currentState?.gpt_situation || '').trim();
    const activeLinkProgress = Number(currentState?.published_link_progress || 0);
    const activeLinkConfirmedProgress = activeLinkId && linkCounts.has(activeLinkId)
      ? Number(linkCounts.get(activeLinkId)?.progress_events || 0)
      : 0;

    return jsonResponse(200, {
      period: periodKey,
      date_from: dateFromIso,
      date_to: dateToIso,
      active_link: {
        id: activeLinkId || null,
        text: activeLinkText,
        title: activeLinkRow?.new_belief || activeLinkRow?.stimulus || activeLinkText || 'Связка',
        slot_no: activeLinkRow?.slot_no ?? null,
        status: activeLinkRow?.status || null,
        stimulus: activeLinkRow?.stimulus || '',
        reaction: activeLinkRow?.reaction || '',
        old_belief: activeLinkRow?.old_belief || '',
        new_belief: activeLinkRow?.new_belief || '',
        new_actions: activeLinkRow?.new_actions || '',
        overall_progress: Number.isFinite(activeLinkProgress) && activeLinkProgress >= 0
          ? Math.floor(activeLinkProgress)
          : 0,
        confirmed_progress: activeLinkConfirmedProgress,
      },
      weeks: Array.from(weeksMap.values()).sort((a, b) => b.week_start.localeCompare(a.week_start)),
      links: Array.from(linkCounts.values()).sort((a, b) => b.progress_events - a.progress_events),
      recent_events: progressEvents.slice(0, 20),
    });
  } catch (error) {
    console.error('links-progress-report error:', error);
    return jsonResponse(500, { error: 'Не удалось построить отчёт по связкам' });
  }
};

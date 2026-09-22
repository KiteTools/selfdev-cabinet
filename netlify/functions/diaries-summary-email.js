import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { normalizeSummary, renderSummaryToMarkdown, sendEmail } from './lib/summarizer.js';

function isValidEmail(value) {
  return /.+@.+\..+/.test(String(value || ''));
}

function parseDateOnlyUtc(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Date(Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate()
  ));
}

function formatDiaryPeriodHuman(dateFrom, dateTo) {
  const from = parseDateOnlyUtc(dateFrom);
  const to = parseDateOnlyUtc(dateTo);
  if (!from || !to) {
    return `${dateFrom || '—'} - ${dateTo || '—'}`;
  }

  const fromDay = from.getUTCDate();
  const toDay = to.getUTCDate();
  const fromMonth = from.toLocaleDateString('ru-RU', { month: 'long', timeZone: 'UTC' });
  const toMonth = to.toLocaleDateString('ru-RU', { month: 'long', timeZone: 'UTC' });
  const fromYear = from.getUTCFullYear();
  const toYear = to.getUTCFullYear();

  if (from.getTime() === to.getTime()) {
    return `${fromDay} ${fromMonth} ${fromYear} года`;
  }
  if (fromYear === toYear) {
    if (fromMonth === toMonth) {
      return `с ${fromDay} по ${toDay} ${toMonth} ${toYear} года`;
    }
    return `с ${fromDay} ${fromMonth} по ${toDay} ${toMonth} ${toYear} года`;
  }
  return `с ${fromDay} ${fromMonth} ${fromYear} года по ${toDay} ${toMonth} ${toYear} года`;
}

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

  const summaryId = String(body.summary_id || '').trim();
  const email = String(body.email || '').trim();
  const customSummaryText = String(body.summary_text || '').trim();

  if (!email || !isValidEmail(email)) {
    return jsonResponse(400, { error: 'Некорректный email' });
  }

  try {
    const rows = summaryId
      ? await query(
        `SELECT id, date_from, date_to, summary_type, status, summary_text, summary_json, created_at
         FROM diary_summaries
         WHERE id = $1
           AND user_id = $2`,
        [summaryId, user.user_id]
      )
      : await query(
        `SELECT id, date_from, date_to, summary_type, status, summary_text, summary_json, created_at
         FROM diary_summaries
         WHERE user_id = $1
         ORDER BY updated_at DESC
         LIMIT 1`,
        [user.user_id]
      );

    if (rows.length === 0) {
      return jsonResponse(404, { error: 'Саммари дневников не найдено' });
    }

    const summary = rows[0];
    if (summary.status !== 'completed') {
      return jsonResponse(409, { error: 'Саммари ещё не готово' });
    }

    let summaryText = customSummaryText;
    if (!summaryText) {
      summaryText = String(summary.summary_text || '').trim();
    }
    if (!summaryText && summary.summary_json) {
      const normalized = normalizeSummary(summary.summary_json);
      summaryText = renderSummaryToMarkdown(normalized, { summaryType: summary.summary_type });
    }

    if (!summaryText) {
      return jsonResponse(409, { error: 'Текст саммари пустой' });
    }

    const periodLabel = formatDiaryPeriodHuman(summary.date_from, summary.date_to);
    const subject = `Саммари дневников за период ${periodLabel}`;
    await sendEmail({
      to: email,
      subject,
      body: summaryText,
    });

    return jsonResponse(200, { ok: true });
  } catch (error) {
    console.error('diaries-summary-email error:', error);
    return jsonResponse(500, { error: 'Не удалось отправить email' });
  }
};

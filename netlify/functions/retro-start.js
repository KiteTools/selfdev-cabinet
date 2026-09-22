import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { resolveRetroPeriod } from './lib/phase4.js';

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

  const period = resolveRetroPeriod(body.date_from, body.date_to);
  if (period.error) {
    return jsonResponse(400, { error: period.error });
  }

  try {
    const [diaryCountRows, razborRows, linksRows, progressRows, crmRows] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total
         FROM diary_entries
         WHERE user_id = $1
           AND local_date BETWEEN $2::date AND $3::date`,
        [user.user_id, period.dateFrom, period.dateTo]
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM razbor_sessions
         WHERE user_id = $1
           AND occurred_at::date BETWEEN $2::date AND $3::date`,
        [user.user_id, period.dateFrom, period.dateTo]
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM links_registry
         WHERE user_id = $1
           AND created_at::date BETWEEN $2::date AND $3::date`,
        [user.user_id, period.dateFrom, period.dateTo]
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM link_progress_events
         WHERE user_id = $1
           AND created_at::date BETWEEN $2::date AND $3::date`,
        [user.user_id, period.dateFrom, period.dateTo]
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM crm_activity_events
         WHERE user_id = $1
           AND occurred_at::date BETWEEN $2::date AND $3::date`,
        [user.user_id, period.dateFrom, period.dateTo]
      ),
    ]);

    const totalInputs = [
      diaryCountRows[0]?.total || 0,
      razborRows[0]?.total || 0,
      linksRows[0]?.total || 0,
      progressRows[0]?.total || 0,
      crmRows[0]?.total || 0,
    ].reduce((sum, value) => sum + value, 0);

    if (totalInputs === 0) {
      return jsonResponse(409, { error: 'За выбранный период нет данных для ретро' });
    }

    const rows = await query(
      `INSERT INTO retro_reports (
         user_id, date_from, date_to, status, prompt_version, input_summary, retro_text, error_message, created_at, updated_at
       ) VALUES (
         $1, $2::date, $3::date, 'processing', NULL, NULL, NULL, NULL, now(), now()
       )
       RETURNING id, created_at, date_from, date_to`,
      [user.user_id, period.dateFrom, period.dateTo]
    );

    return jsonResponse(200, {
      ok: true,
      id: rows[0].id,
      created_at: rows[0].created_at,
      date_from: rows[0].date_from,
      date_to: rows[0].date_to,
    });
  } catch (error) {
    console.error('retro-start error:', error);
    return jsonResponse(500, { error: 'Не удалось создать задачу ретро' });
  }
};

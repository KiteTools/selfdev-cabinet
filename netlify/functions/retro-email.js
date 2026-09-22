import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { isValidEmail } from './lib/phase4.js';
import { sendEmail } from './lib/summarizer.js';

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

  const retroId = String(body.retro_id || '').trim();
  const email = String(body.email || '').trim();
  const customText = String(body.retro_text || '').trim();

  if (!retroId) {
    return jsonResponse(400, { error: 'retro_id required' });
  }
  if (!isValidEmail(email)) {
    return jsonResponse(400, { error: 'Некорректный email' });
  }

  try {
    const rows = await query(
      `SELECT date_from, date_to, status, retro_text
       FROM retro_reports
       WHERE id = $1
         AND user_id = $2`,
      [retroId, user.user_id]
    );
    if (rows.length === 0) {
      return jsonResponse(404, { error: 'Ретро не найдено' });
    }
    if (rows[0].status !== 'completed') {
      return jsonResponse(409, { error: 'Ретро ещё не готово' });
    }

    const retroText = customText || String(rows[0].retro_text || '').trim();
    if (!retroText) {
      return jsonResponse(409, { error: 'Текст ретро пустой' });
    }

    const subject = `Ретро за период ${rows[0].date_from} .. ${rows[0].date_to}`;
    await sendEmail({
      to: email,
      subject,
      body: retroText,
    });

    return jsonResponse(200, { ok: true });
  } catch (error) {
    console.error('retro-email error:', error);
    return jsonResponse(500, { error: 'Не удалось отправить ретро на email' });
  }
};

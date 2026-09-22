import { validateTelegramWidget, validateTelegramWebApp, createToken as sign, buildSessionCookie, jsonResponse, jsonResponseWithCookie } from './auth.js';
import { getTransport } from './transport.js';
import { fromSendPulse, getDefaultQuotes } from './variables.js';
import { query as dbQuery } from './db.js';

/** Shared ownership gate for both Telegram entry points. */
export function createLoginHandler(kind, { env = process.env, transport, query = dbQuery, createToken = sign } = {}) {
  return async event => {
    if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
    let body;
    try { body = JSON.parse(event.body); } catch { return jsonResponse(400, { error: 'Invalid JSON' }); }
    if (!body || typeof body !== 'object') return jsonResponse(400, { error: 'Invalid JSON' });
    const input = kind === 'widget' ? body.telegramData : body.initData;
    if (!input) return jsonResponse(400, { error: `${kind === 'widget' ? 'telegramData' : 'initData'} required` });
    const validated = kind === 'widget'
      ? { valid: validateTelegramWidget(input, env.TELEGRAM_BOT_TOKEN), user: input }
      : validateTelegramWebApp(input, env.TELEGRAM_BOT_TOKEN);
    if (!validated.valid || !Number.isSafeInteger(validated.user?.id) || validated.user.id <= 0) return jsonResponse(403, { error: 'Invalid Telegram signature' });
    const user = validated.user;
    try {
      const adapter = transport || getTransport();
      // No variables, user records or session are accessed before this gate.
      const contact = await adapter.resolveContactForTelegram({ telegramUserId: user.id, requestedContactId: body.sp_contact_id });
      if (!contact) return jsonResponse(403, { error: 'contact_binding_failed', message: 'Откройте Личный кабинет из своего бота после /start.' });
      let rows = await query('SELECT id, sendpulse_contact_id FROM users WHERE telegram_user_id = $1', [user.id]);
      if (!rows.length) {
        rows = await query(`INSERT INTO users (telegram_user_id, sendpulse_contact_id) VALUES ($1, $2)
          ON CONFLICT (telegram_user_id) DO UPDATE SET telegram_user_id = EXCLUDED.telegram_user_id
          RETURNING id, sendpulse_contact_id`, [user.id, contact.id]);
      }
      const record = rows[0];
      if (record.sendpulse_contact_id !== contact.id) return jsonResponse(409, { error: 'contact_binding_changed', message: 'Настройка транспорта изменилась. Нужна миграция привязки оператором.' });
      const stateRows = await query('SELECT 1 FROM current_state WHERE user_id = $1', [record.id]);
      if (!stateRows.length) {
        let state = fromSendPulse(await adapter.getContactVariables(contact.id));
        if (!Object.values(state).some(v => v !== '' && v !== null && v !== undefined)) state = { ...state, ...getDefaultQuotes('base'), quote_pack: 'base' };
        // Concurrent first logins must never overwrite an already saved state.
        const inserted = await query(`INSERT INTO current_state (user_id, data) VALUES ($1, $2)
          ON CONFLICT (user_id) DO NOTHING RETURNING user_id`, [record.id, JSON.stringify(state)]);
        if (inserted.length) await query('INSERT INTO versions (user_id, data) VALUES ($1, $2)', [record.id, JSON.stringify(state)]);
      }
      const token = await createToken({ user_id: record.id, telegram_user_id: user.id, sendpulse_contact_id: contact.id, transport: adapter.kind });
      return jsonResponseWithCookie(200, { ok: true, user: { id: record.id, name: user.first_name || '' }, transport: adapter.kind }, buildSessionCookie(token));
    } catch {
      // Upstream errors can contain personal payloads; don't log or echo them.
      return jsonResponse(500, { error: 'Authentication unavailable' });
    }
  };
}

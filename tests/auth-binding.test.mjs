import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import { createLoginHandler } from '../netlify/functions/lib/login.js';
import { validateTelegramWidget, validateTelegramWebApp, createToken, authenticateRequest } from '../netlify/functions/lib/auth.js';
import { createLocalTransport } from '../netlify/functions/lib/transports/local.js';

const bot = 'synthetic-bot-token';
function widget(id = 101, age = 0) {
  const data = { id, first_name: 'Example', auth_date: Math.floor(Date.now() / 1000) - age };
  data.hash = createHmac('sha256', createHash('sha256').update(bot).digest()).update(Object.keys(data).sort().map(k => `${k}=${data[k]}`).join('\n')).digest('hex');
  return data;
}
function webapp(id = 101) {
  const params = new URLSearchParams({ user: JSON.stringify({ id }), auth_date: String(Math.floor(Date.now() / 1000)) });
  const check = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  params.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update(bot).digest()).update(check).digest('hex'));
  return params.toString();
}

test('Telegram auth rejects stale, future and tampered signed identities', () => {
  assert.equal(validateTelegramWidget(widget(), bot), true);
  assert.equal(validateTelegramWidget(widget(101, 1000), bot), false);
  assert.equal(validateTelegramWidget(widget(101, -1000), bot), false);
  assert.equal(validateTelegramWidget({ ...widget(), id: 202 }, bot), false);
  assert.equal(validateTelegramWebApp(webapp(), bot).valid, true);
  assert.equal(validateTelegramWebApp(webapp().replace('101', '202'), bot).valid, false);
});

for (const kind of ['widget', 'webapp']) {
  test(`${kind}: signed user A cannot request user B contact or touch state`, async () => {
    let reads = 0;
    const handler = createLoginHandler(kind, {
      env: { TELEGRAM_BOT_TOKEN: bot },
      transport: { resolveContactForTelegram: async ({ telegramUserId, requestedContactId }) => requestedContactId === `contact-${telegramUserId}` ? { id: requestedContactId } : null,
        getContactVariables: async () => { reads++; return {}; } },
      query: async () => { reads++; return []; },
    });
    const body = { sp_contact_id: 'contact-202', ...(kind === 'widget' ? { telegramData: widget(101) } : { initData: webapp(101) }) };
    const result = await handler({ httpMethod: 'POST', body: JSON.stringify(body) });
    assert.equal(result.statusCode, 403);
    assert.equal(reads, 0);
  });
}

test('local login persists initial state without SendPulse and signs canonical binding', async () => {
  const writes = [], signed = [];
  const handler = createLoginHandler('widget', {
    env: { TELEGRAM_BOT_TOKEN: bot }, transport: createLocalTransport(),
    query: async (sql, params) => {
      writes.push([sql, params]);
      if (sql.includes('INSERT INTO users')) return [{ id: 'synthetic-user', sendpulse_contact_id: 'local:101' }];
      if (sql.includes('INSERT INTO current_state')) return [{ user_id: 'synthetic-user' }];
      return [];
    },
    createToken: async payload => { signed.push(payload); return 'synthetic-jwt'; },
  });
  const result = await handler({ httpMethod: 'POST', body: JSON.stringify({ telegramData: widget() }) });
  assert.equal(result.statusCode, 200);
  assert.equal(signed[0].sendpulse_contact_id, 'local:101');
  assert.ok(writes.some(([sql]) => sql.includes('INSERT INTO current_state')));
  assert.equal(JSON.parse(result.body).transport, 'local');
});

test('existing incompatible contact binding fails closed', async () => {
  const handler = createLoginHandler('widget', {
    env: { TELEGRAM_BOT_TOKEN: bot }, transport: createLocalTransport(),
    query: async () => [{ id: 'synthetic-user', sendpulse_contact_id: 'contact-from-another-mode' }],
    createToken: async () => { throw new Error('must not issue token'); },
  });
  assert.equal((await handler({ httpMethod: 'POST', body: JSON.stringify({ telegramData: widget() }) })).statusCode, 409);
});

test('missing JWT configuration cannot create a session', async () => {
  const old = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try { await assert.rejects(createToken({ user_id: 'synthetic' }), /JWT_SECRET/); }
  finally { if (old !== undefined) process.env.JWT_SECRET = old; }
});

test('service-created JWT remains valid in its transport and is rejected after mode switch', async () => {
  const previousSecret = process.env.JWT_SECRET, previousMode = process.env.CABINET_TRANSPORT;
  process.env.JWT_SECRET = 'synthetic-test-secret-that-is-at-least-32-characters';
  process.env.CABINET_TRANSPORT = 'local';
  try {
    const token = await createToken({ user_id: 'synthetic', sendpulse_contact_id: 'local:101' });
    const event = { headers: { cookie: `lk_session=${token}` } };
    assert.equal((await authenticateRequest(event)).user_id, 'synthetic');
    process.env.CABINET_TRANSPORT = 'sendpulse';
    assert.equal(await authenticateRequest(event), null);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
    if (previousMode === undefined) delete process.env.CABINET_TRANSPORT; else process.env.CABINET_TRANSPORT = previousMode;
  }
});

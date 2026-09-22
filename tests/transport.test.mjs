import test from 'node:test';
import assert from 'node:assert/strict';
import { createSendPulseTransport } from '../netlify/functions/lib/transports/sendpulse.js';
import { createLocalTransport } from '../netlify/functions/lib/transports/local.js';
import { createTransport } from '../netlify/functions/lib/transport.js';

// All identifiers and tokens in this file are synthetic; no network is used.
function fixture(responses) {
  const calls = [], queries = [], waits = [];
  const transport = createSendPulseTransport({
    env: { SENDPULSE_CLIENT_ID: 'synthetic-client', SENDPULSE_CLIENT_SECRET: 'synthetic-secret', SENDPULSE_BOT_ID: 'synthetic-bot' },
    query: async (sql, params) => { queries.push([sql, params]); return sql.startsWith('SELECT') ? [{ access_token: 'synthetic-token', expires_at: '2099-01-01' }] : []; },
    fetchImpl: async (url, opts) => { calls.push([url, opts]); assert.ok(responses.length, 'unexpected request'); return responses.shift(); },
    sleep: async ms => waits.push(ms),
  });
  return { transport, calls, queries, waits };
}
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });

test('SendPulse binds the requested contact to authoritative Telegram lookup', async () => {
  const { transport, calls } = fixture([response({ success: true, data: { id: 'contact-a', telegram_id: '101', bot_id: 'synthetic-bot' } })]);
  assert.equal((await transport.resolveContactForTelegram({ telegramUserId: 101, requestedContactId: 'contact-a' })).id, 'contact-a');
  const url = new URL(calls[0][0]);
  assert.equal(url.pathname, '/telegram/contacts/getByTelegramId');
  assert.equal(url.searchParams.get('telegram_id'), '101');
  assert.equal(url.searchParams.get('bot_id'), 'synthetic-bot');
});

test('SendPulse denies substitution of a second person contact', async () => {
  const { transport, calls } = fixture([response({ data: { id: 'contact-a', telegram_id: '101', bot_id: 'synthetic-bot' } })]);
  assert.equal(await transport.resolveContactForTelegram({ telegramUserId: 101, requestedContactId: 'contact-b' }), null);
  assert.equal(calls.length, 1);
});

test('SendPulse fails closed for unsuccessful or malformed lookup', async () => {
  for (const data of [{ success: false, data: { id: 'contact-a', telegram_id: '101', bot_id: 'synthetic-bot' } }, { data: {} }, {}]) {
    const { transport } = fixture([response(data)]);
    assert.equal(await transport.resolveContactForTelegram({ telegramUserId: 101, requestedContactId: 'contact-a' }), null);
  }
});

test('SendPulse variable roundtrip uses documented payload and escapes contact id', async () => {
  const { transport, calls } = fixture([response({ data: { variables: [{ name: 'quote', value: 'synthetic text' }] } }), response({ success: true })]);
  assert.deepEqual(await transport.getContactVariables('contact&other=x'), { quote: 'synthetic text' });
  assert.equal(new URL(calls[0][0]).searchParams.get('id'), 'contact&other=x');
  const result = await transport.syncVariables('contact-a', { quote: 42 });
  assert.equal(result.delivered, true);
  assert.deepEqual(JSON.parse(calls[1][1].body), { contact_id: 'contact-a', variables: [{ variable_name: 'quote', variable_value: '42' }] });
});

test('SendPulse retries only bounded 429; errors never echo response contents', async () => {
  const { transport, waits } = fixture([response({ secret: 'PRIVATE' }, 429), response({ success: true })]);
  await transport.syncVariables('contact-a', { quote: 'private text' });
  assert.deepEqual(waits, [2000]);
  const bad = fixture([response({ secret: 'PRIVATE' }, 500)]);
  await assert.rejects(bad.transport.syncVariables('contact-a', { quote: 'private text' }), err => !/PRIVATE|private text/.test(err.message));
  assert.equal(bad.calls.length, 1);
});

test('local transport binds Telegram identity and explicitly reports no delivery', async () => {
  const transport = createLocalTransport();
  assert.deepEqual(await transport.resolveContactForTelegram({ telegramUserId: 101 }), { id: 'local:101' });
  assert.equal(await transport.resolveContactForTelegram({ telegramUserId: 101, requestedContactId: 'local:202' }), null);
  assert.deepEqual(await transport.getContactVariables('local:101'), {});
  assert.deepEqual(await transport.syncVariables('local:101', { quote: 'synthetic' }), { transport: 'local', delivered: false, reason: 'delivery_disabled' });
  assert.throws(() => createTransport({ env: { CABINET_TRANSPORT: 'typo' } }), /Unsupported/);
});

test('SendPulse validates both bot and Telegram fields of the lookup response', async () => {
  for (const data of [{ id: 'contact-a', telegram_id: '202', bot_id: 'synthetic-bot' }, { id: 'contact-a', telegram_id: '101', bot_id: 'another-bot' }]) {
    const { transport } = fixture([response({ success: true, data })]);
    assert.equal(await transport.resolveContactForTelegram({ telegramUserId: 101, requestedContactId: 'contact-a' }), null);
  }
});

test('SendPulse refreshes an expired token once after 401', async () => {
  let cached = true;
  const calls = [], mutations = [];
  const responses = [response({}, 401), response({ access_token: 'new-synthetic-token', expires_in: 3600 }), response({ data: { id: 'contact-a', variables: {} } })];
  const transport = createSendPulseTransport({
    env: { SENDPULSE_CLIENT_ID: 'synthetic-client', SENDPULSE_CLIENT_SECRET: 'synthetic-secret' },
    query: async (sql, params) => {
      if (sql.startsWith('DELETE')) cached = false;
      if (sql.startsWith('INSERT')) mutations.push(params);
      return sql.startsWith('SELECT') && cached ? [{ access_token: 'old-synthetic-token', expires_at: '2099-01-01' }] : [];
    },
    fetchImpl: async (url, opts) => { calls.push([url, opts]); return responses.shift(); },
  });
  await transport.getContactVariables('contact-a');
  assert.equal(calls.length, 3);
  assert.match(calls[1][0], /oauth\/access_token$/);
  assert.equal(calls[2][1].headers.Authorization, 'Bearer new-synthetic-token');
  assert.equal(mutations[0][0], 'new-synthetic-token');
});

test('SendPulse stops after four rate-limit attempts', async () => {
  const { transport, calls, waits } = fixture(Array.from({ length: 4 }, () => response({}, 429)));
  await assert.rejects(transport.syncVariables('contact-a', { quote: 'synthetic' }), { status: 429 });
  assert.equal(calls.length, 4);
  assert.deepEqual(waits, [2000, 4000, 8000]);
});

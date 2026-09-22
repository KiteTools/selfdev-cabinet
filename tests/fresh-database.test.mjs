import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { migrationPlan } from '../scripts/migrate.mjs';
import { createLoginHandler } from '../netlify/functions/lib/login.js';
import { createLocalTransport } from '../netlify/functions/lib/transports/local.js';
import { createSummaryBackgroundHandler } from '../netlify/functions/summarize-background.mjs';

// In-memory PostgreSQL WASM only. No sockets, credentials, or existing database.
test('fresh PostgreSQL schema, repeat migrations, unique binding and two-user endpoint isolation', async t => {
  const db = new PGlite();
  const query = async (sql, params = []) => (await db.query(sql, params)).rows;
  const plan = await migrationPlan();
  try {
    await t.test('all 16 migrations execute on empty PostgreSQL and safely repeat', async () => {
      assert.equal(plan.length, 16);
      for (const migration of plan) await db.exec(migration.sql);
      for (const migration of plan) await db.exec(migration.sql);
      const tables = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
      assert.ok(tables.some(row => row.table_name === 'consultations'));
      assert.ok(tables.some(row => row.table_name === 'successes'));
    });

    const bot = 'synthetic-test-bot-token';
    const login = createLoginHandler('widget', { env: { TELEGRAM_BOT_TOKEN: bot }, transport: createLocalTransport(), query, createToken: async () => 'synthetic-token' });
    const eventFor = id => {
      const data = { id, first_name: 'Synthetic', auth_date: Math.floor(Date.now() / 1000) };
      data.hash = createHmac('sha256', createHash('sha256').update(bot).digest()).update(Object.keys(data).sort().map(k => `${k}=${data[k]}`).join('\n')).digest('hex');
      return { httpMethod: 'POST', body: JSON.stringify({ telegramData: data }) };
    };
    let userA, userB;
    await t.test('real login SQL is idempotent and creates separate account state', async () => {
      const [a, b] = await Promise.all([login(eventFor(101)), login(eventFor(202))]);
      assert.equal(a.statusCode, 200);
      assert.equal(b.statusCode, 200);
      userA = JSON.parse(a.body).user.id;
      userB = JSON.parse(b.body).user.id;
      assert.notEqual(userA, userB);
      await login(eventFor(101));
      assert.equal((await query('SELECT * FROM users')).length, 2);
      assert.equal((await query('SELECT * FROM current_state')).length, 2);
      assert.equal((await query('SELECT * FROM versions')).length, 2);
      await assert.rejects(query('INSERT INTO users (telegram_user_id, sendpulse_contact_id) VALUES ($1, $2)', [303, 'local:101']), { code: '23505' });
    });

    await t.test('real consultation SQL rejects another user and claims a job only once', async () => {
      const [{ id }] = await query('INSERT INTO consultations (user_id) VALUES ($1) RETURNING id', [userA]);
      let calls = 0;
      const parseForm = async () => ({ fields: {}, files: { transcript: { filename: 'synthetic.txt', size: 18, buffer: Buffer.from('Synthetic episode.') } } });
      const shared = { query, parseForm, runSummary: async () => { calls++; return { request: 'Synthetic summary' }; } };
      const forbidden = createSummaryBackgroundHandler({ ...shared, authenticate: async () => ({ user_id: userB }) });
      const event = { httpMethod: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=synthetic' }, queryStringParameters: { id } };
      assert.equal((await forbidden(event)).statusCode, 404);
      assert.equal(calls, 0);
      const owner = createSummaryBackgroundHandler({ ...shared, authenticate: async () => ({ user_id: userA }) });
      assert.equal((await owner(event)).statusCode, 200);
      assert.equal((await owner(event)).statusCode, 200);
      assert.equal(calls, 1);
      const [stored] = await query('SELECT status, summary_json, processing_started_at FROM consultations WHERE id = $1', [id]);
      assert.equal(stored.status, 'completed');
      assert.equal(stored.summary_json.request, 'Synthetic summary');
      assert.ok(stored.processing_started_at);
    });
  } finally { await db.close(); }
});

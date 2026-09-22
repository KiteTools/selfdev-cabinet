import test from 'node:test';
import assert from 'node:assert/strict';
import { createStatePatchHandler } from '../netlify/functions/state-patch.js';
import { createLocalTransport } from '../netlify/functions/lib/transports/local.js';

test('local state patch saves data and version but explicitly reports no external delivery', async () => {
  const current = { tz: 'UTC', t1: '08:00', t2: '22:00' };
  const saved = [], versions = [];
  const handler = createStatePatchHandler({
    authenticate: async () => ({ user_id: 'synthetic-user', sendpulse_contact_id: 'local:101' }),
    readState: async () => current,
    sync: createLocalTransport().syncVariables,
    mergeState: async (user, changes) => { saved.push([user, changes]); return { ...current, ...changes }; },
    saveVersion: async (user, state) => versions.push([user, state]),
  });
  const result = await handler({ httpMethod: 'PATCH', body: JSON.stringify({ changes: { gpt_zapros: 'Synthetic request' } }) });
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).delivery.delivered, false);
  assert.equal(JSON.parse(result.body).data.gpt_zapros, 'Synthetic request');
  assert.equal(saved.length, 1);
  assert.equal(versions.length, 1);
});

test('failed external synchronization is not reported as a saved database version', async () => {
  let writes = 0;
  const originalError = console.error;
  console.error = () => {};
  try {
    const handler = createStatePatchHandler({
      authenticate: async () => ({ user_id: 'synthetic-user', sendpulse_contact_id: 'contact-a' }),
      readState: async () => ({ tz: 'UTC', t1: '08:00', t2: '22:00' }),
      sync: async () => { throw Object.assign(new Error('rate limited'), { status: 429 }); },
      mergeState: async () => { writes++; }, saveVersion: async () => { writes++; },
    });
    const result = await handler({ httpMethod: 'PATCH', body: JSON.stringify({ changes: { gpt_zapros: 'Synthetic' } }) });
    assert.equal(result.statusCode, 503);
    assert.equal(writes, 0);
  } finally { console.error = originalError; }
});

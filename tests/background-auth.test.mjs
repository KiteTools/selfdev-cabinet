import test from 'node:test';
import assert from 'node:assert/strict';
import { createSummaryBackgroundHandler } from '../netlify/functions/summarize-background.mjs';
// Synthetic RFC4122 UUID; never refers to a real consultation.
const id = '00000000-0000-4000-8000-000000000001';
const event = { httpMethod: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=synthetic' }, queryStringParameters: { id } };
const form = async () => ({ fields: {}, files: { transcript: { size: 10 } } });

test('background endpoint rejects an unauthenticated request before parsing or database access', async () => {
  const handler = createSummaryBackgroundHandler({ authenticate: async () => null, query: async () => { throw new Error('must not query'); }, parseForm: async () => { throw new Error('must not parse'); } });
  assert.equal((await handler(event)).statusCode, 401);
});

test('background endpoint cannot read or update another account consultation by UUID', async () => {
  const calls = [];
  const handler = createSummaryBackgroundHandler({ authenticate: async () => ({ user_id: 'user-a' }), parseForm: form,
    query: async (sql, args) => { calls.push([sql, args]); assert.match(sql, /id = \$1 AND user_id = \$2/); assert.deepEqual(args, [id, 'user-a']); return []; },
    runSummary: async () => { throw new Error('must not call AI'); },
  });
  assert.equal((await handler(event)).statusCode, 404);
  assert.equal(calls.length, 1);
});

test('already claimed background job is not sent to AI again', async () => {
  const calls = [];
  const handler = createSummaryBackgroundHandler({ authenticate: async () => ({ user_id: 'user-a' }), parseForm: form,
    query: async (sql, args) => { calls.push([sql, args]); return sql.includes('SELECT id, user_id') ? [{ id, status: 'processing', user_id: 'user-a' }] : []; },
    runSummary: async () => { throw new Error('must not call AI'); },
  });
  const result = await handler(event);
  assert.equal(result.statusCode, 202);
  assert.equal(JSON.parse(result.body).status, 'already_started');
  assert.match(calls[1][0], /processing_started_at IS NULL/);
  assert.equal(calls[1][1][2], 'user-a');
});

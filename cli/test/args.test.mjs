import test from 'node:test';
import assert from 'node:assert/strict';

import { parseCliArgs } from '../src/core/args.mjs';
import { loadCliEnv } from '../src/core/env.mjs';

test('parseCliArgs returns nested command tokens and flags', () => {
  const parsed = parseCliArgs([
    'consultation',
    'summarize',
    'start',
    '--transcript',
    'fixtures/transcript.txt',
    '--email',
    'owner@example.com',
    '--write',
  ]);

  assert.deepEqual(parsed.commandPath, ['consultation', 'summarize', 'start']);
  assert.equal(parsed.flags.transcript, 'fixtures/transcript.txt');
  assert.equal(parsed.flags.email, 'owner@example.com');
  assert.equal(parsed.flags.write, true);
});

test('loadCliEnv normalizes defaults and trims trailing slash', () => {
  const env = loadCliEnv({
    LK_BASE_URL: 'http://localhost:8888/',
    LK_SERVICE_SECRET: 'top-secret',
    LK_CLI_SP_CONTACT_ID: '12345',
  });

  assert.equal(env.baseUrl, 'http://localhost:8888');
  assert.equal(env.serviceSecret, 'top-secret');
  assert.equal(env.spContactId, '12345');
  assert.equal(env.output, 'text');
});

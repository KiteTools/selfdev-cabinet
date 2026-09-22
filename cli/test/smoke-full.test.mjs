import test from 'node:test';
import assert from 'node:assert/strict';

import { runFullSmoke } from '../src/smoke/full.mjs';

test('runFullSmoke executes read-only checks in a stable order', async () => {
  const calls = [];
  const report = await runFullSmoke({
    flags: { from: '2026-04-01', to: '2026-04-12' },
    runNamedCommand: async (name) => {
      calls.push(name);
      return { ok: true, name };
    },
  });

  assert.deepEqual(calls, [
    'me',
    'state get',
    'versions list',
    'diaries list',
    'links list',
    'retro status',
  ]);
  assert.equal(report.failed, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { addSummaryApplyCycleReset } from '../netlify/functions/lib/summary-apply.js';
import { toSendPulse } from '../netlify/functions/lib/variables.js';

test('summary apply resets cycle day to one when current day is not one', () => {
  const changes = addSummaryApplyCycleReset(
    { aff1: 'Новая аффирмация' },
    { cycle_day: 7 }
  );

  assert.deepEqual(changes, {
    aff1: 'Новая аффирмация',
    cycle_day: 1,
  });
});

test('summary apply keeps cycle day unchanged when it is already one', () => {
  const changes = addSummaryApplyCycleReset(
    { aff1: 'Новая аффирмация' },
    { cycle_day: 1 }
  );

  assert.deepEqual(changes, {
    aff1: 'Новая аффирмация',
  });
});

test('summary apply cycle reset is explicit enough to sync manual-only SendPulse day', () => {
  const changes = addSummaryApplyCycleReset(
    { aff1: 'Новая аффирмация' },
    { cycle_day: 4 }
  );
  const spVars = toSendPulse(changes, null, new Set(Object.keys(changes)));

  assert.equal(spVars['№ дня'], 1);
});

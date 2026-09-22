import test from 'node:test';
import assert from 'node:assert/strict';

import { assertWriteAllowed, describeTarget } from '../src/core/guards.mjs';

test('assertWriteAllowed rejects mutating commands without --write', () => {
  assert.throws(
    () => assertWriteAllowed({ mutating: true, command: 'state patch' }, { write: false }),
    /requires --write/
  );
});

test('describeTarget labels production hosts', () => {
  assert.equal(
    describeTarget('https://cabinet.example.invalid'),
    'production'
  );
});

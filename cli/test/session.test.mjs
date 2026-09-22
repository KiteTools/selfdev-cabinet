import test from 'node:test';
import assert from 'node:assert/strict';

import { bootstrapCliSession } from '../src/http/session.mjs';

test('bootstrapCliSession stores the lk_session cookie', async () => {
  const calls = [];
  const client = {
    setSessionCookie(value) {
      calls.push(value);
    },
  };

  const session = await bootstrapCliSession({
    client,
    baseUrl: 'http://localhost:8888',
    serviceSecret: 'top-secret',
    spContactId: 'sp-1',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return name.toLowerCase() === 'set-cookie'
            ? 'lk_session=jwt-token; Path=/; HttpOnly'
            : 'application/json';
        },
      },
      async json() {
        return { ok: true, user: { id: 'user-1' } };
      },
    }),
  });

  assert.equal(calls[0], 'lk_session=jwt-token');
  assert.equal(session.user.id, 'user-1');
});

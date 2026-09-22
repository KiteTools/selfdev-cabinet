import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthCliHandler } from '../../netlify/functions/auth-cli.js';

test('auth-cli requires sp_contact_id or user_id', async () => {
  const handler = createAuthCliHandler({
    authorize: async () => ({ ok: true }),
    getByContact: async () => null,
    getById: async () => null,
    signToken: async () => 'jwt',
    makeCookie: () => 'lk_session=jwt; Path=/',
  });

  const response = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({}),
  });

  assert.equal(response.statusCode, 400);
});

test('auth-cli issues a session cookie for a known user', async () => {
  const handler = createAuthCliHandler({
    authorize: async () => ({ ok: true }),
    getByContact: async () => ({
      id: 'user-1',
      telegram_user_id: 'tg-1',
      sendpulse_contact_id: 'sp-1',
    }),
    getById: async () => null,
    signToken: async () => 'jwt-token',
    makeCookie: () => 'lk_session=jwt-token; HttpOnly; Path=/',
  });

  const response = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ sp_contact_id: 'sp-1' }),
    headers: {},
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['Set-Cookie'], /^lk_session=jwt-token;/);
});

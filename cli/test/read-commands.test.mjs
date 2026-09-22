import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthCommands } from '../src/commands/auth.mjs';
import { createStateCommands } from '../src/commands/state.mjs';

test('me command reads /api/me', async () => {
  const calls = [];
  const commands = createAuthCommands({
    requestJson: async (request) => {
      calls.push(request);
      return { user_id: 'user-1', telegram_user_id: 'tg-1' };
    },
    env: {
      baseUrl: 'http://localhost:8888',
      target: 'local',
      serviceSecret: 'secret',
      spContactId: 'sp-1',
      userId: '',
    },
  });

  const result = await commands.me.run({ flags: {} });
  assert.equal(calls[0].path, '/api/me');
  assert.equal(result.user_id, 'user-1');
});

test('state get reads /api/state-get', async () => {
  const commands = createStateCommands({
    requestJson: async () => ({
      data: { name: 'Megan', gpt_situation: 'Фокус' },
    }),
  });

  const result = await commands.get.run({ flags: {} });
  assert.equal(result.data.name, 'Megan');
});

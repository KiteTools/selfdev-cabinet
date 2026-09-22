import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { createDiariesCommands } from '../src/commands/diaries.mjs';
import { createRetroCommands } from '../src/commands/retro.mjs';
import { createStateCommands } from '../src/commands/state.mjs';
import { createVersionsCommands } from '../src/commands/versions.mjs';

test('state patch reads changes from disk and sends PATCH body', async () => {
  let request = null;
  const commands = createStateCommands({
    requestJson: async (next) => {
      request = next;
      return { ok: true };
    },
  });

  await commands.patch.run({
    flags: { file: fileURLToPath(new URL('./fixtures/state-patch.json', import.meta.url)) },
  });

  assert.equal(request.method, 'PATCH');
  assert.equal(request.path, '/api/state-patch');
});

test('state patch requires --file', async () => {
  const commands = createStateCommands({
    requestJson: async () => ({ ok: true }),
  });

  await assert.rejects(
    () => commands.patch.run({ flags: {} }),
    /requires --file/
  );
});

test('versions restore requires --id', async () => {
  const commands = createVersionsCommands({
    requestJson: async () => ({ ok: true }),
  });

  await assert.rejects(
    () => commands.restore.run({ flags: {} }),
    /requires --id/
  );
});

test('diaries-summary start requires period bounds', async () => {
  const commands = createDiariesCommands({
    requestJson: async () => ({ ok: true }),
  });

  await assert.rejects(
    () => commands.summaryStart.run({ flags: { write: true } }),
    /requires --from YYYY-MM-DD --to YYYY-MM-DD/
  );
});

test('retro start requires period bounds', async () => {
  const commands = createRetroCommands({
    requestJson: async () => ({ ok: true }),
  });

  await assert.rejects(
    () => commands.start.run({ flags: { write: true } }),
    /requires --from YYYY-MM-DD --to YYYY-MM-DD/
  );
});

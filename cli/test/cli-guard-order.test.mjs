import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('mutating command without --write fails before session bootstrap', async () => {
  await assert.rejects(
    execFileAsync(
      process.execPath,
      ['cli/index.mjs', 'state', 'patch', '--file', 'cli/test/fixtures/state-patch.json'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          LK_BASE_URL: 'http://127.0.0.1:9',
          LK_SERVICE_SECRET: '',
          LK_CLI_SP_CONTACT_ID: '',
        },
      }
    ),
    /requires --write/
  );
});

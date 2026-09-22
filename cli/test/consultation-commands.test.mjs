import test from 'node:test';
import assert from 'node:assert/strict';

import { createConsultationCommands } from '../src/commands/consultation.mjs';

test('consultation summarize start creates a job and uploads multipart form data', async () => {
  const calls = [];
  const commands = createConsultationCommands({
    requestJson: async (request) => {
      calls.push(request);
      return { id: 'consult-1' };
    },
    requestMultipart: async (request) => {
      calls.push(request);
      return { ok: true, id: 'consult-1' };
    },
    readBinaryFile: async () => Buffer.from('transcript'),
  });

  await commands.summarizeStart.run({
    flags: {
      transcript: '/tmp/transcript.txt',
      email: 'owner@example.com',
      summaryType: 'one_on_one',
      write: true,
    },
  });

  assert.equal(calls[0].path, '/api/summarize-start');
  assert.equal(calls[1].path, '/api/summarize-background?id=consult-1');
});

test('consultation apply preview posts preview=true without --write', async () => {
  let request = null;
  const commands = createConsultationCommands({
    requestJson: async (next) => {
      request = next;
      return { ok: true, preview: {} };
    },
    requestMultipart: async () => {
      throw new Error('unexpected multipart');
    },
    readBinaryFile: async () => Buffer.from(''),
  });

  await commands.apply.run({
    flags: {
      id: 'consult-1',
      preview: true,
    },
    assertWrite() {
      throw new Error('preview should not request write');
    },
  });

  assert.equal(request.json.preview, true);
});

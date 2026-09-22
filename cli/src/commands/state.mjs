import { readFile } from 'node:fs/promises';

async function readJsonFile(filePath) {
  if (!filePath) {
    throw new Error('state patch requires --file <json>');
  }

  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export function createStateCommands({ requestJson }) {
  return {
    get: {
      command: 'state get',
      mutating: false,
      async run() {
        return requestJson({ path: '/api/state-get' });
      },
    },
    patch: {
      command: 'state patch',
      mutating: true,
      async run({ flags }) {
        const changes = await readJsonFile(flags.file);
        return requestJson({
          path: '/api/state-patch',
          method: 'PATCH',
          json: { changes },
        });
      },
    },
  };
}

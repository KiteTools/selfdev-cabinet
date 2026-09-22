export function createVersionsCommands({ requestJson }) {
  return {
    list: {
      command: 'versions list',
      mutating: false,
      async run() {
        return requestJson({ path: '/api/versions-list' });
      },
    },
    restore: {
      command: 'versions restore',
      mutating: true,
      async run({ flags }) {
        if (!flags.id) {
          throw new Error('versions restore requires --id <versionId>');
        }

        return requestJson({
          path: '/api/versions-restore',
          method: 'POST',
          json: { version_id: String(flags.id) },
        });
      },
    },
  };
}

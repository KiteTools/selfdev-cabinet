export function createLinksCommands({ requestJson }) {
  return {
    list: {
      command: 'links list',
      mutating: false,
      async run() {
        return requestJson({ path: '/api/links' });
      },
    },
  };
}

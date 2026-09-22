function requireRetroPeriod(flags) {
  if (!flags.from || !flags.to) {
    throw new Error('retro start requires --from YYYY-MM-DD --to YYYY-MM-DD');
  }
}

export function createRetroCommands({ requestJson }) {
  return {
    start: {
      command: 'retro start',
      mutating: true,
      async run({ flags }) {
        requireRetroPeriod(flags);
        return requestJson({
          path: '/api/retro-start',
          method: 'POST',
          json: {
            date_from: String(flags.from),
            date_to: String(flags.to),
          },
        });
      },
    },
    status: {
      command: 'retro status',
      mutating: false,
      async run({ flags }) {
        const query = flags.id ? `?id=${encodeURIComponent(String(flags.id))}` : '';
        return requestJson({ path: `/api/retro-status${query}` });
      },
    },
  };
}

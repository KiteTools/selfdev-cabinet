function requirePeriod(flags, commandName) {
  if (!flags.from || !flags.to) {
    throw new Error(`${commandName} requires --from YYYY-MM-DD --to YYYY-MM-DD`);
  }
}

export function createDiariesCommands({ requestJson }) {
  return {
    list: {
      command: 'diaries list',
      mutating: false,
      async run({ flags }) {
        requirePeriod(flags, 'diaries list');
        const params = new URLSearchParams({
          date_from: String(flags.from),
          date_to: String(flags.to),
        });

        return requestJson({ path: `/api/diaries?${params}` });
      },
    },
    summaryStart: {
      command: 'diaries-summary start',
      mutating: true,
      async run({ flags }) {
        requirePeriod(flags, 'diaries-summary start');
        return requestJson({
          path: '/api/diaries-summary-start',
          method: 'POST',
          json: {
            date_from: String(flags.from),
            date_to: String(flags.to),
          },
        });
      },
    },
    summaryStatus: {
      command: 'diaries-summary status',
      mutating: false,
      async run({ flags }) {
        const query = flags.id ? `?id=${encodeURIComponent(String(flags.id))}` : '';
        return requestJson({ path: `/api/diaries-summary-status${query}` });
      },
    },
  };
}

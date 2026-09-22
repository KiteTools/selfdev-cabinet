export async function runFullSmoke({ flags, runNamedCommand }) {
  const report = {
    target_range: {
      from: String(flags.from || ''),
      to: String(flags.to || ''),
    },
    steps: [],
    failed: 0,
  };

  const steps = [
    ['me', {}],
    ['state get', {}],
    ['versions list', {}],
    ['diaries list', { from: flags.from, to: flags.to }],
    ['links list', {}],
    ['retro status', {}],
  ];

  for (const [name, stepFlags] of steps) {
    try {
      const result = await runNamedCommand(name, stepFlags);
      report.steps.push({ name, mode: 'read', ok: true, result });
    } catch (error) {
      report.steps.push({ name, mode: 'read', ok: false, error: error.message });
      report.failed += 1;
    }
  }

  if (flags.write) {
    const writeSteps = [];

    if (flags.patchFile) {
      writeSteps.push(['state patch', { file: flags.patchFile, write: true }]);
    }

    if (flags.diarySummary) {
      writeSteps.push(['diaries-summary start', { from: flags.from, to: flags.to, write: true }]);
    }

    if (flags.retroStart) {
      writeSteps.push(['retro start', { from: flags.from, to: flags.to, write: true }]);
    }

    for (const [name, stepFlags] of writeSteps) {
      try {
        const result = await runNamedCommand(name, stepFlags);
        report.steps.push({ name, mode: 'write', ok: true, result });
      } catch (error) {
        report.steps.push({ name, mode: 'write', ok: false, error: error.message });
        report.failed += 1;
      }
    }
  }

  return report;
}

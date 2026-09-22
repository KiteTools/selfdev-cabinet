export function addSummaryApplyCycleReset(changes, currentState) {
  const nextChanges = { ...(changes || {}) };
  const currentCycleDay = currentState?.cycle_day;

  if (String(currentCycleDay ?? '') !== '1') {
    nextChanges.cycle_day = 1;
  }

  return nextChanges;
}

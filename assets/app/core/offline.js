export function createOfflineController({
  flushChanges,
  getPendingChanges,
  setStatus,
}) {
  function setupOfflineDetection() {
    window.addEventListener('online', () => {
      setStatus('Сохранено', 'saved');
      if (Object.keys(getPendingChanges() || {}).length > 0) {
        flushChanges();
      }
    });

    window.addEventListener('offline', () => {
      setStatus('Нет сети', 'offline');
    });
  }

  return {
    setupOfflineDetection,
  };
}

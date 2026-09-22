export function createStartupController({
  api,
  loadConsultationHistory,
  loadVersions,
  populateFields,
  setCurrentState,
  setStatus,
  showScreen,
}) {
  async function startApp() {
    showScreen('screen-app');
    setStatus('Загрузка данных...', '');

    try {
      const stateResult = await api('state-get');
      const nextState = stateResult.data || {};
      const notice = typeof document === 'undefined' ? null : document.getElementById('transport-notice');
      if (notice) {
        notice.hidden = stateResult.transport !== 'local';
        notice.textContent = 'Локальный режим: данные сохраняются в Личном кабинете. Доставка в бот отключена.';
      }
      setCurrentState(nextState);

      populateFields(nextState);
      setStatus('Сохранено', 'saved');

      await loadVersions();
      await loadConsultationHistory(true);
    } catch (err) {
      console.error('Load error:', err);
      setStatus('Ошибка загрузки', 'error');
    }
  }

  return {
    startApp,
  };
}

export function createAppInitController({
  generateAffirmationFields,
  generateQuoteFields,
  generateGptFields,
  gptFields,
  generateRazborSendpulseFields,
  initTheme,
  bindThemeToggle,
  bindDashboardEvents = () => {},
  bindTabEvents,
  bindFieldEvents,
  bindVersionEvents,
  bindConsultationEvents,
  bindDiaryEvents,
  bindLinksEvents,
  bindRetroEvents,
  setupOfflineDetection,
  authenticate,
  startApp,
  handleAuthError,
}) {
  function init() {
    generateAffirmationFields();
    generateQuoteFields();
    generateGptFields(gptFields);
    generateRazborSendpulseFields();

    initTheme();
    bindThemeToggle();
    bindDashboardEvents();

    bindTabEvents();
    bindFieldEvents();
    bindVersionEvents();
    bindConsultationEvents();
    bindDiaryEvents();
    bindLinksEvents();
    bindRetroEvents();
    setupOfflineDetection();

    authenticate()
      .then(startApp)
      .catch((err) => {
        if (err.status !== 404) {
          handleAuthError(err);
        }
      });
  }

  return {
    init,
  };
}

import { api } from './app/core/api.js';
import { createAppInitController } from './app/core/app-init.js';
import { createAppStore } from './app/core/app-store.js';
import { createAutosaveController } from './app/core/autosave.js';
import { createAuthController } from './app/core/auth.js';
import { formatDate, formatDateTime } from './app/core/date.js';
import { $, $$ } from './app/core/dom.js';
import {
  generateAffirmationFields,
  generateGptFields,
  generateQuoteFields,
} from './app/core/dynamic-fields.js';
import { createFieldBindingsController } from './app/core/field-bindings.js';
import { autosizeTextareas, syncFieldUiValue } from './app/core/fields.js';
import { renderMarkdown } from './app/core/markdown.js';
import { createOfflineController } from './app/core/offline.js';
import {
  applyDiaryPreset,
  applyRetroPreset,
  formatDiaryPeriodHuman,
} from './app/core/periods.js';
import { createPopulateFields } from './app/core/populate-fields.js';
import { createStartupController } from './app/core/startup.js';
import { createTabsController } from './app/core/tabs.js';
import { createThemeController } from './app/core/theme.js';
import { createVersionsController } from './app/core/versions.js';
import {
  hideAppModal,
  setStatus,
  showAppModal,
  showToast,
  showScreen,
  smoothScrollToBottom,
  smoothScrollToElement,
} from './app/core/ui.js';
import { GPT_FIELDS } from './app/config/gpt-fields.js';
import { RAZBOR_FALSE_KEYS, RAZBOR_NEW_KEYS } from './app/config/razbor-slots.js';
import { STARTER_PACKS } from './app/config/starter-packs.js';
import { createConsultationEditorController } from './app/features/consultation-editor.js';
import { createConsultationsController } from './app/features/consultations.js';
import { createDashboardController } from './app/features/dashboard.js';
import { createDiariesController } from './app/features/diaries.js';
import { createLinksController } from './app/features/links.js';
import { createRazborController } from './app/features/razbor.js';
import { createRetroController } from './app/features/retro.js';

/* ============================================================
   Личный кабинет — Frontend (Vanilla JS)
   ============================================================ */

const appStore = createAppStore();

let scheduleAutosave = () => {};
let onFieldChange = () => {};
let flushChanges = async () => {};
let loadVersions = async () => {};
let showPreviousValues = () => {};
let bindVersionEvents = () => {};
let bindTabEvents = () => {};
let bindFieldEvents = () => {};
let setStarterPackSelection = () => {};
let setupOfflineDetection = () => {};
let authenticate = async () => {};
let handleAuthError = () => {};
let startApp = async () => {};
let initTheme = () => {};
let toggleTheme = () => {};
let loadConsultationHistory = async () => {};
let bindConsultationEvents = () => {};
let openConsultation = async () => {};
let openDashboardTab = async () => {};
let bindDashboardEvents = () => {};
let openDiaryTab = async () => {};
let openDiaryPeriod = async () => {};
let bindDiaryEvents = () => {};
let openRazborTab = async () => {};
let openLinksTab = async () => {};
let bindLinksEvents = () => {};
let openRetroTab = async () => {};
let openRetroPeriod = async () => {};
let bindRetroEvents = () => {};
let getEditedSummaryText = () => '';
let handleConsultEditorClick = async () => {};
let loadConsultationEditorFromSummary = () => {};
let resetConsultationEditor = () => {};
let generateRazborSendpulseFields = () => {};
let activateTab = () => {};
let dashboardCanLoad = false;

// --- Constants ---
const DEBOUNCE_MS = 800;
const CONSULTATION_POLL_MS = 3000;
const CONSULTATION_MAX_ATTEMPTS = 200;
const DIARY_SUMMARY_POLL_MS = 3000;
const DIARY_SUMMARY_MAX_ATTEMPTS = 200;
const RETRO_POLL_MS = 3000;
const RETRO_MAX_ATTEMPTS = 200;
const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = ['txt', 'md', 'vtt'];
const CONSULT_EMAIL_STORAGE_KEY = 'lk_consultation_email';
const DIARY_EMAIL_STORAGE_KEY = 'lk_diary_summary_email';
const RETRO_EMAIL_STORAGE_KEY = 'lk_retro_email';

const populateFields = createPopulateFields({
  syncFieldUiValue,
  setStarterPackSelection: (value) => setStarterPackSelection(value),
  getCurrentState: appStore.getCurrentState,
});

const versionsController = createVersionsController({
  api,
  formatDate,
  setStatus,
  getVersions: appStore.getVersions,
  setVersions: appStore.setVersions,
  getCurrentState: appStore.getCurrentState,
  setCurrentState: appStore.setCurrentState,
  populateFields,
  getOnFieldChange: () => onFieldChange,
});

loadVersions = versionsController.loadVersions;
showPreviousValues = versionsController.showPreviousValues;
bindVersionEvents = versionsController.bindVersionEvents;
const scheduleVersionsRefresh = versionsController.scheduleVersionsRefresh;

const consultationEditorController = createConsultationEditorController({
  api,
  loadVersions,
  populateFields,
  setCurrentState: appStore.setCurrentState,
  setStatus,
});

getEditedSummaryText = consultationEditorController.getEditedSummaryText;
handleConsultEditorClick = consultationEditorController.handleConsultEditorClick;
loadConsultationEditorFromSummary = consultationEditorController.loadSummary;
resetConsultationEditor = consultationEditorController.resetConsultationEditor;

const consultationsController = createConsultationsController({
  api,
  allowedUploadExtensions: ALLOWED_UPLOAD_EXTENSIONS,
  consultEmailStorageKey: CONSULT_EMAIL_STORAGE_KEY,
  consultationMaxAttempts: CONSULTATION_MAX_ATTEMPTS,
  consultationPollMs: CONSULTATION_POLL_MS,
  formatDateTime,
  getCurrentState: appStore.getCurrentState,
  getEditedSummaryText,
  hideAppModal,
  loadConsultationEditorFromSummary,
  loadVersions,
  maxUploadFileBytes: MAX_UPLOAD_FILE_BYTES,
  populateFields,
  setCurrentState: appStore.setCurrentState,
  setStatus,
  showAppModal,
  smoothScrollToBottom,
  smoothScrollToElement,
});

loadConsultationHistory = consultationsController.loadConsultationHistory;
bindConsultationEvents = () => consultationsController.bindConsultationEvents({
  handleConsultEditorClick,
  resetConsultationEditor,
});
openConsultation = consultationsController.openConsultation;

const diariesController = createDiariesController({
  api,
  diaryEmailStorageKey: DIARY_EMAIL_STORAGE_KEY,
  diarySummaryMaxAttempts: DIARY_SUMMARY_MAX_ATTEMPTS,
  diarySummaryPollMs: DIARY_SUMMARY_POLL_MS,
  formatDate,
  formatDateTime,
  formatDiaryPeriodHuman,
  renderMarkdown,
  setStatus,
  showAppModal,
  smoothScrollToElement,
  applyDiaryPreset,
});

openDiaryTab = diariesController.openDiaryTab;
openDiaryPeriod = diariesController.openDiaryPeriod;
bindDiaryEvents = diariesController.bindDiaryEvents;

const razborController = createRazborController({
  api,
  formatDateTime,
  razborFalseKeys: RAZBOR_FALSE_KEYS,
  razborNewKeys: RAZBOR_NEW_KEYS,
});

generateRazborSendpulseFields = razborController.generateRazborSendpulseFields;
openRazborTab = razborController.openRazborTab;

const linksController = createLinksController({
  api,
  formatDateTime,
  setStatus,
  showAppModal,
  showToast,
  smoothScrollToElement,
});

openLinksTab = linksController.openLinksTab;
bindLinksEvents = linksController.bindLinksEvents;

const retroController = createRetroController({
  api,
  retroEmailStorageKey: RETRO_EMAIL_STORAGE_KEY,
  retroMaxAttempts: RETRO_MAX_ATTEMPTS,
  retroPollMs: RETRO_POLL_MS,
  formatDateTime,
  formatDiaryPeriodHuman,
  setStatus,
  showAppModal,
  smoothScrollToElement,
  applyRetroPreset,
});

openRetroTab = retroController.openRetroTab;
openRetroPeriod = retroController.openRetroPeriod;
bindRetroEvents = retroController.bindRetroEvents;

const dashboardController = createDashboardController({
  api,
  formatDiaryPeriodHuman,
  activateTab: (target, options) => activateTab(target, options),
  setStatus,
  smoothScrollToElement,
});

openDashboardTab = dashboardController.openDashboardTab;
bindDashboardEvents = dashboardController.bindDashboardEvents;

function maybeOpenDashboardTab(force = false) {
  if (!dashboardCanLoad) return Promise.resolve();
  return openDashboardTab(force);
}

const tabsController = createTabsController({
  onDashboardTab: () => maybeOpenDashboardTab(),
  onConsultationsTab: async (options = {}) => {
    await loadConsultationHistory();
    if (options.consultationId) {
      await openConsultation(options.consultationId);
    }
  },
  onDiariesTab: (options = {}) => (options.period ? openDiaryPeriod(options.period) : openDiaryTab()),
  onRazborTab: () => openRazborTab(),
  onLinksTab: () => openLinksTab(),
  onRetroTab: (options = {}) => (options.period ? openRetroPeriod(options.period) : openRetroTab()),
  onTabActivated: (target) => {
    const tabContent = $(`#tab-${target}`);
    if (!tabContent) return;
    autosizeTextareas(tabContent);
  },
});

bindTabEvents = tabsController.bindTabEvents;
activateTab = tabsController.activateTab;

({ scheduleAutosave, onFieldChange, flushChanges } = createAutosaveController({
  api,
  debounceMs: DEBOUNCE_MS,
  getCurrentState: appStore.getCurrentState,
  setCurrentState: appStore.setCurrentState,
  getIsSaving: appStore.getIsSaving,
  setIsSaving: appStore.setIsSaving,
  getPendingChanges: appStore.getPendingChanges,
  setPendingChanges: appStore.setPendingChanges,
  getSaveTimer: appStore.getSaveTimer,
  setSaveTimer: appStore.setSaveTimer,
  scheduleVersionsRefresh,
  selectField: (field) => $(`[data-key="${field}"]`),
  setStatus,
  syncFieldUiValue,
}));

const fieldBindingsController = createFieldBindingsController({
  starterPacks: STARTER_PACKS,
  getSelectedStarterPackKey: appStore.getSelectedStarterPackKey,
  setSelectedStarterPackKey: appStore.setSelectedStarterPackKey,
  getCurrentState: appStore.getCurrentState,
  setCurrentState: appStore.setCurrentState,
  getPendingChanges: appStore.getPendingChanges,
  setPendingChanges: appStore.setPendingChanges,
  onFieldChange,
  scheduleAutosave,
  showPreviousValues,
  syncFieldUiValue,
});

bindFieldEvents = fieldBindingsController.bindFieldEvents;
setStarterPackSelection = fieldBindingsController.setStarterPackSelection;

const offlineController = createOfflineController({
  flushChanges,
  getPendingChanges: appStore.getPendingChanges,
  setStatus,
});

setupOfflineDetection = offlineController.setupOfflineDetection;

const authController = createAuthController({
  api,
  getSpContactId: appStore.getSpContactId,
  selectLoginWidget: () => $('#telegram-login-widget'),
  selectRetryButton: () => $('#btn-retry'),
  selectStartMessage: () => $('#screen-start .center-box p'),
  setSpContactId: appStore.setSpContactId,
  showScreen,
});

authenticate = authController.authenticate;
handleAuthError = authController.handleAuthError;

const startupController = createStartupController({
  api,
  loadConsultationHistory,
  loadVersions,
  populateFields,
  setCurrentState: appStore.setCurrentState,
  setStatus,
  showScreen,
});

const startAppBase = startupController.startApp;
startApp = async () => {
  await startAppBase();
  dashboardCanLoad = true;
  if ($('#tab-dashboard')?.classList.contains('active')) {
    await openDashboardTab(true);
  }
};

const themeController = createThemeController();

initTheme = themeController.initTheme;
toggleTheme = themeController.toggleTheme;

const appInitController = createAppInitController({
  generateAffirmationFields,
  generateQuoteFields,
  generateGptFields,
  gptFields: GPT_FIELDS,
  generateRazborSendpulseFields,
  initTheme,
  bindThemeToggle: () => {
    $('#btn-theme-toggle')?.addEventListener('click', toggleTheme);
  },
  bindDashboardEvents,
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
});

document.addEventListener('DOMContentLoaded', appInitController.init);

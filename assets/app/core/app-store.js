export function createAppStore() {
  let currentState = {};
  let versions = [];
  let pendingChanges = {};
  let saveTimer = null;
  let isSaving = false;
  let spContactId = null;
  let selectedStarterPackKey = 'base';

  return {
    getCurrentState: () => currentState,
    setCurrentState: (value) => {
      currentState = value;
    },
    getVersions: () => versions,
    setVersions: (value) => {
      versions = value;
    },
    getPendingChanges: () => pendingChanges,
    setPendingChanges: (value) => {
      pendingChanges = value;
    },
    getSaveTimer: () => saveTimer,
    setSaveTimer: (value) => {
      saveTimer = value;
    },
    getIsSaving: () => isSaving,
    setIsSaving: (value) => {
      isSaving = value;
    },
    getSpContactId: () => spContactId,
    setSpContactId: (value) => {
      spContactId = value;
    },
    getSelectedStarterPackKey: () => selectedStarterPackKey,
    setSelectedStarterPackKey: (value) => {
      selectedStarterPackKey = value;
    },
  };
}

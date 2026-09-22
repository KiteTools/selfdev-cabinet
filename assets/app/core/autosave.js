export function createAutosaveController({
  api,
  debounceMs,
  getCurrentState,
  setCurrentState,
  getIsSaving,
  setIsSaving,
  getPendingChanges,
  setPendingChanges,
  getSaveTimer,
  setSaveTimer,
  scheduleVersionsRefresh,
  selectField,
  setStatus,
  syncFieldUiValue,
}) {
  function canSave() {
    const currentState = getCurrentState() || {};
    const tz = currentState.tz;
    const t1 = currentState.t1;
    const t2 = currentState.t2;

    if (tz === '' || t1 === '' || t2 === '') {
      return true;
    }
    return true;
  }

  async function flushChanges() {
    const pendingChanges = getPendingChanges() || {};
    if (getIsSaving() || Object.keys(pendingChanges).length === 0) return;

    const changes = { ...pendingChanges };
    setPendingChanges({});
    setIsSaving(true);
    setStatus('Сохраняю...', 'saving');

    try {
      const previousState = { ...(getCurrentState() || {}) };
      const result = await api('state-patch', {
        method: 'PATCH',
        body: JSON.stringify({ changes }),
      });

      if (result.data) {
        setCurrentState(result.data);
        if (String(result.data.gpt_situation || '') !== String(previousState.gpt_situation || '')) {
          syncFieldUiValue('gpt_situation', result.data.gpt_situation || '');
        }
        if (String(result.data.link_main || '') !== String(previousState.link_main || '')) {
          syncFieldUiValue('link_main', result.data.link_main || '');
        }
      }

      setStatus('Сохранено', 'saved');
      scheduleVersionsRefresh?.();
    } catch (err) {
      console.error('Save error:', err);
      setPendingChanges({
        ...changes,
        ...(getPendingChanges() || {}),
      });

      if (err.status === 422 && err.data?.errors) {
        const firstErr = Object.values(err.data.errors)[0];
        setStatus(firstErr, 'error');
        for (const field of Object.keys(err.data.errors)) {
          const el = selectField(field);
          if (el) {
            el.classList.add('invalid');
            el.addEventListener('input', () => el.classList.remove('invalid'), { once: true });
          }
        }
      } else if (err.status === 503) {
        setStatus('SendPulse временно недоступен', 'error');
      } else {
        setStatus(err.data?.error || 'Ошибка сохранения', 'error');
      }
    } finally {
      setIsSaving(false);
      const queuedChanges = getPendingChanges() || {};
      if (Object.keys(queuedChanges).length > 0) {
        setSaveTimer(setTimeout(flushChanges, debounceMs));
      }
    }
  }

  function scheduleAutosave() {
    const saveTimer = getSaveTimer();
    if (saveTimer) clearTimeout(saveTimer);

    if (!canSave()) {
      setStatus('Заполните обязательные поля', 'error');
      return;
    }

    setStatus('Изменения...', '');
    setSaveTimer(setTimeout(flushChanges, debounceMs));
  }

  function onFieldChange(key, value) {
    const nextState = {
      ...(getCurrentState() || {}),
      [key]: value,
    };

    if (key === 'link_main' || key === 'gpt_situation') {
      const mirroredValue = value ?? '';
      nextState.gpt_situation = mirroredValue;
      nextState.link_main = mirroredValue;
      syncFieldUiValue('gpt_situation', mirroredValue);
      syncFieldUiValue('link_main', mirroredValue);
    }

    setCurrentState(nextState);
    setPendingChanges({
      ...(getPendingChanges() || {}),
      [key]: value,
    });
    scheduleAutosave();
  }

  return {
    flushChanges,
    onFieldChange,
    scheduleAutosave,
  };
}

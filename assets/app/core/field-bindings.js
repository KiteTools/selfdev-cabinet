import { $, $$ } from './dom.js';
import { autosizeTextarea, registerAutosizeTextarea } from './fields.js';

export function createFieldBindingsController({
  starterPacks,
  getSelectedStarterPackKey,
  setSelectedStarterPackKey,
  getCurrentState,
  setCurrentState,
  getPendingChanges,
  setPendingChanges,
  onFieldChange,
  scheduleAutosave,
  showPreviousValues,
  syncFieldUiValue,
}) {
  function normalizeStarterPackKey(packKey) {
    return starterPacks[packKey] ? packKey : 'base';
  }

  function setStarterPackSelection(packKey) {
    const normalized = normalizeStarterPackKey(String(packKey || '').trim());
    setSelectedStarterPackKey(normalized);
    const radio = $(`input[name="quote_pack"][value="${normalized}"]`);
    if (radio) radio.checked = true;
  }

  function applyStarterPack() {
    const currentState = getCurrentState() || {};
    const pendingChanges = getPendingChanges() || {};
    const packKey = normalizeStarterPackKey(getSelectedStarterPackKey() || currentState.quote_pack);
    const pack = starterPacks[packKey];
    if (!pack) return;

    const confirmed = confirm(
      `Применить набор ${pack.label}? Это перезапишет 10 аффирмаций, 10 цитат и вопросы на утро/вечер.`
    );
    if (!confirmed) {
      setStarterPackSelection(currentState.quote_pack || 'base');
      return;
    }

    const changes = {
      quote_pack: packKey,
      q_morning: pack.q_morning,
      q_evening: pack.q_evening,
    };

    for (let i = 0; i < 10; i++) {
      changes[`aff${i + 1}`] = pack.affirmations[i] || '';
      changes[`q${i + 1}`] = pack.quotes[i] || '';
    }

    const nextState = { ...currentState };
    const nextPendingChanges = { ...pendingChanges };

    for (const [key, value] of Object.entries(changes)) {
      if (key === 'quote_pack') {
        setStarterPackSelection(value);
      } else {
        syncFieldUiValue(key, value);
      }
      nextState[key] = value;
      nextPendingChanges[key] = value;
    }

    setCurrentState(nextState);
    setPendingChanges(nextPendingChanges);
    scheduleAutosave();
  }

  function bindFieldEvents() {
    $$('[data-key]').forEach((el) => {
      const key = el.dataset.key;

      if (el.type === 'radio') {
        el.addEventListener('change', () => {
          if (key === 'quote_pack') {
            setStarterPackSelection(el.value);
          } else {
            onFieldChange(key, el.value);
          }
        });
      } else {
        if (el.tagName === 'TEXTAREA') {
          registerAutosizeTextarea(el);
        }

        el.addEventListener('input', () => {
          if (el.tagName === 'TEXTAREA') {
            autosizeTextarea(el);
          }
          onFieldChange(key, el.value);
        });

        el.addEventListener('dblclick', () => {
          showPreviousValues(el, key);
        });
      }
    });

    $('#btn-apply-starter-pack')?.addEventListener('click', applyStarterPack);
  }

  return {
    bindFieldEvents,
    setStarterPackSelection,
  };
}

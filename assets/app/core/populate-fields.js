import { $ } from './dom.js';

export function createPopulateFields({
  syncFieldUiValue,
  setStarterPackSelection,
  getCurrentState,
}) {
  return function populateFields(data) {
    for (const [key, value] of Object.entries(data || {})) {
      const el = $(`[data-key="${key}"]`);
      if (!el) continue;
      syncFieldUiValue(key, value);
      if (key === 'quote_pack') {
        setStarterPackSelection(value);
      }
    }

    if (!Object.prototype.hasOwnProperty.call(data || {}, 'quote_pack')) {
      setStarterPackSelection(getCurrentState()?.quote_pack || 'base');
    }
  };
}

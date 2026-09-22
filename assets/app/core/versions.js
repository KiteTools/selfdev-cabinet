import { $ } from './dom.js';
import { escapeHtml } from './html.js';

export function createVersionsController({
  api,
  formatDate,
  setStatus,
  getVersions,
  setVersions,
  getCurrentState,
  setCurrentState,
  populateFields,
  getOnFieldChange,
}) {
  let refreshTimer = null;

  async function loadVersions() {
    try {
      const result = await api('versions-list');
      setVersions(result.versions || []);
      renderVersionsDropdown();
    } catch (err) {
      console.error('Load versions error:', err);
    }
  }

  function scheduleVersionsRefresh(delayMs = 1500) {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      loadVersions();
    }, delayMs);
  }

  function renderVersionsDropdown() {
    const select = $('#f-version');
    if (!select) return;
    select.innerHTML = '<option value="">—</option>';
    for (const version of getVersions()) {
      const opt = document.createElement('option');
      opt.value = version.id;
      opt.textContent = formatDate(version.created_at);
      select.appendChild(opt);
    }
    const restoreButton = $('#btn-restore');
    if (restoreButton) restoreButton.disabled = true;
  }

  async function restoreVersion() {
    const select = $('#f-version');
    const versionId = select?.value;
    if (!versionId) return;

    const version = getVersions().find((item) => item.id === versionId);
    if (!version) return;

    if (!confirm('Восстановить эту версию? Текущие значения будут перезаписаны.')) return;

    setStatus('Восстанавливаю...', 'saving');

    try {
      const result = await api('versions-restore', {
        method: 'POST',
        body: JSON.stringify({ version_id: versionId }),
      });

      if (result.data) {
        setCurrentState(result.data);
        populateFields(result.data);
      }

      setStatus('Версия восстановлена', 'saved');
      await loadVersions();
    } catch (err) {
      console.error('Restore error:', err);
      setStatus('Ошибка восстановления', 'error');
    }
  }

  function getPreviousValues(key) {
    const valuesMap = new Map();
    const currentState = getCurrentState() || {};

    for (const version of getVersions()) {
      const value = version.data?.[key];
      if (value !== undefined && value !== null && value !== '' && value !== currentState[key]) {
        if (!valuesMap.has(value)) {
          valuesMap.set(value, version.created_at);
        }
      }
    }

    return Array.from(valuesMap.entries()).map(([value, date]) => ({ value, date }));
  }

  function closePreviousValues() {
    const existing = $('#active-prev-dropdown');
    if (existing) existing.remove();
  }

  function closePreviousValuesHandler(event) {
    if (!event.target.closest('.prev-values-dropdown')) {
      closePreviousValues();
    }
  }

  function showPreviousValues(el, key) {
    closePreviousValues();

    const previousValues = getPreviousValues(key);
    if (previousValues.length === 0) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'prev-values-dropdown open';
    dropdown.id = 'active-prev-dropdown';

    for (const { value, date } of previousValues) {
      const item = document.createElement('div');
      item.className = 'prev-value-item';
      item.innerHTML = `<span class="value">${escapeHtml(String(value).substring(0, 80))}</span><span class="date">${formatDate(date)}</span>`;
      item.addEventListener('click', () => {
        el.value = value;
        getOnFieldChange()(key, value);
        closePreviousValues();
      });
      dropdown.appendChild(item);
    }

    const parent = el.parentElement;
    if (!parent) return;
    parent.style.position = 'relative';
    parent.appendChild(dropdown);

    setTimeout(() => {
      document.addEventListener('click', closePreviousValuesHandler, { once: true });
    }, 0);
  }

  function bindVersionEvents() {
    $('#f-version')?.addEventListener('change', () => {
      const restoreButton = $('#btn-restore');
      if (restoreButton) restoreButton.disabled = !$('#f-version')?.value;
    });

    $('#btn-restore')?.addEventListener('click', restoreVersion);
  }

  return {
    bindVersionEvents,
    closePreviousValues,
    loadVersions,
    renderVersionsDropdown,
    restoreVersion,
    scheduleVersionsRefresh,
    showPreviousValues,
  };
}

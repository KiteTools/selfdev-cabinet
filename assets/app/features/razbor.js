import { $ } from '../core/dom.js';
import { escapeHtml } from '../core/html.js';

export function createRazborController({
  api,
  formatDateTime,
  razborFalseKeys,
  razborNewKeys,
}) {
  let razborHistoryLoaded = false;
  let razborHistory = [];

  function setRazborHistoryError(message) {
    const el = $('#razbor-history-error');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  }

  function renderRazborHistory() {
    const box = $('#razbor-history');
    const meta = $('#razbor-history-meta');
    if (!box || !meta) return;

    meta.textContent = razborHistory.length ? `${razborHistory.length} записей` : 'Нет записей';

    if (!razborHistory.length) {
      box.innerHTML = '<div class="consul-history-empty">Пока нет разборов из SendPulse.</div>';
      return;
    }

    box.innerHTML = razborHistory.map((item) => {
      const summaryText = String(item.summary_text || '').trim();
      const preview = summaryText.length > 1200 ? `${summaryText.slice(0, 1200)}…` : summaryText;
      const metaBits = [
        item.source || 'sendpulse',
        item.status || 'completed',
        formatDateTime(item.occurred_at || item.created_at),
      ].filter(Boolean);

      return `
        <div class="consul-history-item lk-history-item">
          <div class="flex items-start justify-between gap-4">
            <span class="title">${formatDateTime(item.occurred_at || item.created_at)}</span>
            <span class="meta">${escapeHtml(metaBits.join(' · '))}</span>
          </div>
          <p class="text-sm text-slate-700 dark:text-slate-300 mt-2 whitespace-pre-wrap">${escapeHtml(preview)}</p>
        </div>
      `;
    }).join('');
  }

  async function loadRazborHistory(force = false) {
    if (razborHistoryLoaded && !force) {
      renderRazborHistory();
      return;
    }

    try {
      const result = await api('razbor-history');
      razborHistory = Array.isArray(result.items) ? result.items : [];
      razborHistoryLoaded = true;
      setRazborHistoryError('');
      renderRazborHistory();
    } catch (err) {
      console.error('razbor history error', err);
      setRazborHistoryError(err.data?.error || 'Не удалось загрузить историю разборов');
      const box = $('#razbor-history');
      const meta = $('#razbor-history-meta');
      if (box) box.innerHTML = '<div class="consul-history-empty">Не удалось загрузить историю разборов.</div>';
      if (meta) meta.textContent = '';
    }
  }

  async function openRazborTab() {
    await loadRazborHistory(true);
  }

  function createRazborSlotField(key, label) {
    const div = document.createElement('div');
    div.className = 'space-y-2';
    div.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <label for="f-${key}" class="text-sm font-semibold text-slate-700 dark:text-slate-300">${label}</label>
        <span class="text-xs text-slate-400">до 1000 символов</span>
      </div>
      <textarea id="f-${key}" data-key="${key}" rows="5" maxlength="1000" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-y desktop-tall-textarea"></textarea>
    `;
    return div;
  }

  function generateRazborSendpulseFields() {
    const falseContainer = $('#group-razbor-sendpulse-false');
    const newContainer = $('#group-razbor-sendpulse-new');
    if (!falseContainer || !newContainer) return;
    if (falseContainer.childElementCount || newContainer.childElementCount) return;

    razborFalseKeys.forEach((key, index) => {
      falseContainer.appendChild(createRazborSlotField(key, `Слот ${index + 1}`));
    });
    razborNewKeys.forEach((key, index) => {
      newContainer.appendChild(createRazborSlotField(key, `Слот ${index + 1}`));
    });
  }

  return {
    generateRazborSendpulseFields,
    loadRazborHistory,
    openRazborTab,
  };
}

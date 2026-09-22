import { $ } from '../core/dom.js';
import { escapeHtml } from '../core/html.js';
import { renderMarkdown } from '../core/markdown.js';

export function createRetroController({
  api,
  retroEmailStorageKey,
  retroMaxAttempts,
  retroPollMs,
  formatDateTime,
  formatDiaryPeriodHuman,
  renderMarkdown: renderMarkdownFn = renderMarkdown,
  setStatus,
  showAppModal,
  smoothScrollToElement,
  applyRetroPreset,
}) {
  let retroLoaded = false;
  let retroHistory = [];
  let retroPolling = null;
  let activeRetroId = '';
  let activeRetroText = '';

  function rememberRetroEmail(value) {
    if (!value) return;
    try {
      localStorage.setItem(retroEmailStorageKey, value);
    } catch {}
  }

  function loadRememberedRetroEmail() {
    try {
      return localStorage.getItem(retroEmailStorageKey) || '';
    } catch {
      return '';
    }
  }

  function setRetroError(message) {
    const el = $('#retro-error');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  }

  function setRetroProcessing(visible, text = '') {
    const box = $('#retro-processing');
    const textEl = $('#retro-processing-text');
    if (box) box.style.display = visible ? 'flex' : 'none';
    if (textEl && text) textEl.textContent = text;
  }

  function setRetroResultVisible(visible) {
    const box = $('#retro-result');
    if (box) box.style.display = visible ? 'block' : 'none';
  }

  function stopRetroPolling() {
    if (retroPolling) {
      clearTimeout(retroPolling);
      retroPolling = null;
    }
  }

  function readRetroPeriod() {
    const dateFrom = String($('#retro-date-from')?.value || '').trim();
    const dateTo = String($('#retro-date-to')?.value || '').trim();
    if (!dateFrom || !dateTo) {
      return { error: 'Выберите период ретро.' };
    }
    if (dateFrom > dateTo) {
      return { error: 'Дата "от" не может быть позже даты "до".' };
    }
    const fromMs = Date.parse(`${dateFrom}T00:00:00Z`);
    const toMs = Date.parse(`${dateTo}T00:00:00Z`);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      return { error: 'Некорректный формат даты.' };
    }
    const totalDays = Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000)) + 1;
    if (totalDays > 90) {
      return { error: 'Максимальный период — 90 дней.' };
    }
    return { dateFrom, dateTo, totalDays };
  }

  function renderRetroHistory() {
    const box = $('#retro-history');
    const meta = $('#retro-history-meta');
    if (!box) return;
    if (meta) meta.textContent = retroHistory.length ? `${retroHistory.length} запусков` : 'Пока пусто';
    if (!retroHistory.length) {
      box.innerHTML = '<div class="consul-history-empty">Пока нет ретро.</div>';
      return;
    }

    box.innerHTML = retroHistory.map((item) => `
      <button type="button" class="consul-history-item lk-history-item" data-retro-id="${item.id}">
        <span class="title">${escapeHtml(formatDiaryPeriodHuman(item.date_from, item.date_to))}</span>
        <span class="meta">${escapeHtml(item.status || '')} · ${escapeHtml(formatDateTime(item.updated_at || item.created_at))}</span>
      </button>
    `).join('');
  }

  function renderRetroSuccesses(items = []) {
    const section = $('#retro-successes-section');
    const meta = $('#retro-successes-meta');
    const list = $('#retro-successes-list');
    if (!section || !meta || !list) return;

    if (!Array.isArray(items) || items.length === 0) {
      section.style.display = 'none';
      meta.textContent = '';
      list.innerHTML = '';
      return;
    }

    section.style.display = 'block';
    meta.textContent = `${items.length} записей`;
    list.innerHTML = items.map((item) => `
      <article class="lk-success-card rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 px-4 py-3 space-y-2">
        <div class="flex items-center justify-between gap-3 flex-wrap text-xs text-slate-500 dark:text-slate-400">
          <span>${escapeHtml(item.local_date || '')}</span>
          <span>${escapeHtml(formatDateTime(item.created_at || item.local_date || ''))}</span>
        </div>
        <p class="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-200">${escapeHtml(item.text || '')}</p>
      </article>
    `).join('');
  }

  function renderRetroResult(item, options = {}) {
    const shouldScroll = options?.scroll === true;
    activeRetroId = item.id || activeRetroId;
    activeRetroText = item.retro_text || '';
    setRetroError('');
    setRetroProcessing(false);
    setRetroResultVisible(true);

    const head = $('#retro-result-head');
    if (head) {
      head.innerHTML = `
        <h3 class="text-xl font-bold text-slate-900 dark:text-slate-50">Ретро по периоду</h3>
        <p class="text-slate-500 text-sm mt-1">Период: ${escapeHtml(formatDiaryPeriodHuman(item.date_from, item.date_to))} &bull; ${escapeHtml(formatDateTime(item.updated_at || item.created_at))}</p>
      `;
    }

    const html = $('#retro-summary-html');
    if (html) {
      html.innerHTML = renderMarkdownFn(activeRetroText);
    }
    renderRetroSuccesses(item.successes || []);

    const emailForm = $('#retro-email-form');
    if (emailForm) emailForm.style.display = 'none';
    if (shouldScroll) {
      smoothScrollToElement($('#retro-result'), 'start');
    }
  }

  async function loadRetroHistory(force = false) {
    if (retroLoaded && !force) {
      renderRetroHistory();
      return;
    }
    try {
      const result = await api('retro-status');
      retroHistory = result.items || [];
      retroLoaded = true;
      renderRetroHistory();
    } catch (err) {
      console.error('retro history error', err);
      setRetroError(err.data?.error || 'Не удалось загрузить историю ретро');
    }
  }

  async function openRetroById(id) {
    try {
      const result = await api(`retro-status?id=${encodeURIComponent(id)}`);
      if (result.status === 'completed') {
        renderRetroResult(result, { scroll: true });
        return;
      }
      if (result.status === 'failed') {
        setRetroError(result.error_message || 'Ретро завершилось с ошибкой.');
        return;
      }
      setRetroResultVisible(false);
      setRetroProcessing(true, 'Формирую ретро...');
      pollRetroStatus(id, 0);
    } catch (err) {
      console.error('open retro error', err);
      setRetroError(err.data?.error || 'Не удалось открыть ретро');
    }
  }

  function pollRetroStatus(id, attempt = 0) {
    stopRetroPolling();
    if (attempt >= retroMaxAttempts) {
      setRetroProcessing(false);
      setRetroError('Ретро заняло слишком много времени. Попробуйте позже.');
      return;
    }

    retroPolling = setTimeout(async () => {
      try {
        const result = await api(`retro-status?id=${encodeURIComponent(id)}`);
        if (result.status === 'completed') {
          stopRetroPolling();
          renderRetroResult(result, { scroll: true });
          await loadRetroHistory(true);
          return;
        }
        if (result.status === 'failed') {
          stopRetroPolling();
          setRetroProcessing(false);
          setRetroError(result.error_message || 'Не удалось сформировать ретро');
          await loadRetroHistory(true);
          return;
        }
        setRetroProcessing(true, 'Формирую ретро...');
        pollRetroStatus(id, attempt + 1);
      } catch (err) {
        console.error('retro poll error', err);
        pollRetroStatus(id, attempt + 1);
      }
    }, retroPollMs);
  }

  async function startRetro() {
    setRetroError('');
    const period = readRetroPeriod();
    if (period.error) {
      setRetroError(period.error);
      return;
    }

    setRetroResultVisible(false);
    setRetroProcessing(true, 'Создаю задачу ретро...');
    smoothScrollToElement($('#retro-processing'), 'start');

    try {
      const start = await api('retro-start', {
        method: 'POST',
        body: JSON.stringify({
          date_from: period.dateFrom,
          date_to: period.dateTo,
        }),
      });

      activeRetroId = start.id;
      const response = await fetch(`/api/retro-background?id=${encodeURIComponent(start.id)}`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        let data = null;
        try {
          data = await response.json();
        } catch {}
        setRetroProcessing(false);
        setRetroError(data?.error || `Ошибка запуска (HTTP ${response.status})`);
        return;
      }

      setRetroProcessing(true, 'Формирую ретро...');
      await loadRetroHistory(true);
      pollRetroStatus(start.id, 0);
    } catch (err) {
      console.error('start retro error', err);
      setRetroProcessing(false);
      setRetroError(err.data?.error || 'Не удалось запустить ретро');
    }
  }

  async function copyRetro() {
    if (!activeRetroText) return;
    try {
      await navigator.clipboard.writeText(activeRetroText);
      setStatus('Скопировано', 'saved');
    } catch {
      setStatus('Не удалось скопировать', 'error');
    }
  }

  function toggleRetroEmailForm() {
    const form = $('#retro-email-form');
    if (!form) return;
    form.style.display = 'flex';
    smoothScrollToElement(form, 'end');
    $('#retro-email-input')?.focus();
  }

  async function sendRetroEmail() {
    const email = String($('#retro-email-input')?.value || '').trim();
    if (!/.+@.+\..+/.test(email)) {
      setRetroError('Введите корректный email.');
      return;
    }
    if (!activeRetroId) {
      setRetroError('Нет готового ретро для отправки.');
      return;
    }

    try {
      await api('retro-email', {
        method: 'POST',
        body: JSON.stringify({
          retro_id: activeRetroId,
          email,
          retro_text: activeRetroText,
        }),
      });
      rememberRetroEmail(email);
      setStatus('Отправлено на email', 'saved');
      showAppModal(`Ретро отправлено на ${email}.`);
    } catch (err) {
      console.error('retro email error', err);
      setRetroError(err.data?.error || 'Не удалось отправить ретро');
    }
  }

  function saveRetro() {
    if (!activeRetroId) {
      setRetroError('Нет ретро для сохранения.');
      return;
    }
    setStatus('Ретро сохранено', 'saved');
    showAppModal('Ретро уже сохранено в истории и доступно для повторного открытия.');
  }

  async function openRetroPeriod(period) {
    const dateFrom = String(period?.dateFrom || '').trim();
    const dateTo = String(period?.dateTo || '').trim();
    if (dateFrom && dateTo) {
      const preset = $('#retro-period-preset');
      if (preset) preset.value = 'custom';
      const fromInput = $('#retro-date-from');
      const toInput = $('#retro-date-to');
      if (fromInput) fromInput.value = dateFrom;
      if (toInput) toInput.value = dateTo;
      retroLoaded = true;
    }

    await loadRetroHistory(true);
    if (!activeRetroId && retroHistory[0]?.status === 'completed') {
      renderRetroResult(retroHistory[0]);
    }
  }

  async function openRetroTab() {
    if (!retroLoaded) {
      applyRetroPreset('7');
      retroLoaded = true;
    }
    await loadRetroHistory(true);
    if (!activeRetroId && retroHistory[0]?.status === 'completed') {
      renderRetroResult(retroHistory[0]);
    }
  }

  function bindRetroEvents() {
    const remembered = loadRememberedRetroEmail();
    if (remembered && $('#retro-email-input')) {
      $('#retro-email-input').value = remembered;
    }

    $('#retro-period-preset')?.addEventListener('change', (event) => {
      const preset = event.target?.value || '7';
      if (preset !== 'custom') {
        applyRetroPreset(preset);
      }
    });
    $('#retro-date-from')?.addEventListener('change', () => {
      const preset = $('#retro-period-preset');
      if (preset) preset.value = 'custom';
    });
    $('#retro-date-to')?.addEventListener('change', () => {
      const preset = $('#retro-period-preset');
      if (preset) preset.value = 'custom';
    });

    $('#btn-retro-start')?.addEventListener('click', startRetro);
    $('#btn-retro-copy')?.addEventListener('click', copyRetro);
    $('#btn-retro-email')?.addEventListener('click', toggleRetroEmailForm);
    $('#btn-retro-send-email')?.addEventListener('click', sendRetroEmail);
    $('#btn-retro-save')?.addEventListener('click', saveRetro);
    $('#retro-history')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-retro-id]');
      if (!button) return;
      openRetroById(button.dataset.retroId);
    });
  }

  return {
    bindRetroEvents,
    openRetroPeriod,
    openRetroTab,
  };
}

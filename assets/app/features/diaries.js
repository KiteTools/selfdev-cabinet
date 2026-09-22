import { $ } from '../core/dom.js';
import { escapeHtml } from '../core/html.js';
import { renderMarkdown } from '../core/markdown.js';

export function createDiariesController({
  api,
  diaryEmailStorageKey,
  diarySummaryMaxAttempts,
  diarySummaryPollMs,
  formatDate,
  formatDateTime,
  formatDiaryPeriodHuman,
  renderMarkdown: renderMarkdownFn = renderMarkdown,
  setStatus,
  showAppModal,
  smoothScrollToElement,
  applyDiaryPreset,
}) {
  let diariesLoaded = false;
  let diaryEntries = [];
  let diarySummaryPolling = null;
  let activeDiarySummaryId = '';
  let activeDiarySummaryMarkdown = '';

  function parseDiaryDateInputValue(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';

    let year;
    let month;
    let day;

    let match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    } else {
      match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return '';
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    }

    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return '';
    }

    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function formatDiaryDateInputValue(rawValue) {
    const iso = parseDiaryDateInputValue(rawValue);
    if (!iso) return String(rawValue || '').trim();
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return String(rawValue || '').trim();
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  function formatDiaryDateDraft(rawValue) {
    const digits = String(rawValue || '').replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  function normalizeDiaryDateInput(selector) {
    const input = $(selector);
    if (!input) return;
    const formatted = formatDiaryDateInputValue(input.value);
    if (formatted) input.value = formatted;
  }

  function normalizeDiaryDateInputs() {
    normalizeDiaryDateInput('#diary-date-from');
    normalizeDiaryDateInput('#diary-date-to');
  }

  function rememberDiaryEmail(value) {
    if (!value) return;
    try {
      localStorage.setItem(diaryEmailStorageKey, value);
    } catch {}
  }

  function loadRememberedDiaryEmail() {
    try {
      return localStorage.getItem(diaryEmailStorageKey) || '';
    } catch {
      return '';
    }
  }

  function setDiaryError(message) {
    const el = $('#diary-error');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  }

  function setDiaryProcessing(visible, text = '') {
    const box = $('#diary-processing');
    const textEl = $('#diary-processing-text');
    if (box) box.style.display = visible ? 'flex' : 'none';
    if (textEl && text) textEl.textContent = text;
  }

  function setDiaryResultVisible(visible) {
    const box = $('#diary-result');
    if (!box) return;
    box.style.display = visible ? 'block' : 'none';
  }

  function stopDiarySummaryPolling() {
    if (diarySummaryPolling) {
      clearTimeout(diarySummaryPolling);
      diarySummaryPolling = null;
    }
  }

  function readDiaryPeriod() {
    const dateFromRaw = String($('#diary-date-from')?.value || '').trim();
    const dateToRaw = String($('#diary-date-to')?.value || '').trim();
    const dateFrom = parseDiaryDateInputValue(dateFromRaw);
    const dateTo = parseDiaryDateInputValue(dateToRaw);
    if (!dateFrom || !dateTo) {
      return { error: 'Выберите период (дата от и дата до).' };
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

  function renderDiaryEntries(payload) {
    const list = $('#diary-list');
    const meta = $('#diary-list-meta');
    if (!list) return;

    const items = payload?.items || [];
    diaryEntries = items;

    if (meta) {
      const total = payload?.total ?? items.length;
      meta.textContent = `${total} записей`;
    }

    if (!items.length) {
      list.innerHTML = '<div class="diary-empty">За выбранный период дневников нет.</div>';
      return;
    }

    list.innerHTML = '';
    items.forEach((item) => {
      const details = document.createElement('details');
      details.className = 'diary-item';
      details.open = true;
      const localDate = item.local_date ? formatDate(item.local_date) : '—';
      const created = item.created_at ? formatDateTime(item.created_at) : '';
      const source = item.source ? escapeHtml(item.source) : 'unknown';
      details.innerHTML = `
        <summary class="diary-item-head">
          <strong>${localDate}</strong>
          <span class="meta">${source}${created ? ` · ${created}` : ''}</span>
        </summary>
        <pre>${escapeHtml(String(item.text || ''))}</pre>
      `;
      list.appendChild(details);
    });
  }

  async function loadDiaryEntries() {
    setDiaryError('');
    const period = readDiaryPeriod();
    if (period.error) {
      setDiaryError(period.error);
      return;
    }

    try {
      const query = new URLSearchParams({
        date_from: period.dateFrom,
        date_to: period.dateTo,
        limit: '200',
      });
      const result = await api(`diaries?${query.toString()}`);
      renderDiaryEntries(result);
      const btn = $('#btn-diary-summarize');
      if (btn) btn.disabled = !diaryEntries.length;
    } catch (err) {
      console.error('load diaries error', err);
      setDiaryError(err.data?.error || 'Не удалось загрузить дневники');
    }
  }

  function renderDiarySummaryResult(data, options = {}) {
    const shouldScroll = options?.scroll === true;
    activeDiarySummaryId = data.id || activeDiarySummaryId;
    activeDiarySummaryMarkdown = data.summary_text || '';

    setDiaryProcessing(false);
    setDiaryResultVisible(true);
    setDiaryError('');

    const head = $('#diary-result-head');
    if (head) {
      const periodLabel = formatDiaryPeriodHuman(data.date_from, data.date_to);
      head.innerHTML = `
        <h3 class="text-xl font-bold text-slate-900 dark:text-slate-50">Саммари дневников</h3>
        <p class="text-slate-500 text-sm mt-1">Период: ${periodLabel} &bull; ${formatDateTime(data.updated_at || data.created_at)}</p>
      `;
    }

    const html = $('#diary-summary-html');
    if (html) {
      html.innerHTML = renderMarkdownFn(activeDiarySummaryMarkdown);
    }

    const emailForm = $('#diary-email-form');
    if (emailForm) emailForm.style.display = 'none';
    if (shouldScroll) {
      smoothScrollToElement($('#diary-result'), 'start');
    }
  }

  function pollDiarySummaryStatus(id, attempt = 0) {
    stopDiarySummaryPolling();
    if (attempt >= diarySummaryMaxAttempts) {
      setDiaryProcessing(false);
      setDiaryError('Обработка заняла слишком много времени. Попробуйте позже.');
      return;
    }

    diarySummaryPolling = setTimeout(async () => {
      try {
        const result = await api(`diaries-summary-status?id=${encodeURIComponent(id)}`);
        if (result.status === 'completed') {
          stopDiarySummaryPolling();
          renderDiarySummaryResult(result, { scroll: true });
          return;
        }
        if (result.status === 'failed') {
          stopDiarySummaryPolling();
          setDiaryProcessing(false);
          setDiaryError(result.error_message || 'Не удалось сформировать саммари');
          return;
        }
        setDiaryProcessing(true, 'Формирую саммари дневников...');
        pollDiarySummaryStatus(id, attempt + 1);
      } catch (err) {
        console.error('diary summary poll error', err);
        pollDiarySummaryStatus(id, attempt + 1);
      }
    }, diarySummaryPollMs);
  }

  async function loadLatestDiarySummary() {
    try {
      const result = await api('diaries-summary-status');
      const item = result?.item;
      if (!item) return;

      activeDiarySummaryId = item.id || '';
      if (item.status === 'completed') {
        renderDiarySummaryResult(item);
        return;
      }
      if (item.status === 'failed') {
        setDiaryError(item.error_message || 'Последний запуск завершился с ошибкой.');
        return;
      }
      setDiaryResultVisible(false);
      setDiaryProcessing(true, 'Формирую саммари дневников...');
      pollDiarySummaryStatus(item.id, 0);
    } catch (err) {
      console.error('load latest diary summary error', err);
    }
  }

  async function startDiarySummary() {
    setDiaryError('');
    const period = readDiaryPeriod();
    if (period.error) {
      setDiaryError(period.error);
      return;
    }

    if (!diaryEntries.length) {
      setDiaryError('За выбранный период нет дневников.');
      return;
    }

    setDiaryResultVisible(false);
    setDiaryProcessing(true, 'Создаю задачу...');
    smoothScrollToElement($('#diary-processing'), 'start');

    try {
      const start = await api('diaries-summary-start', {
        method: 'POST',
        body: JSON.stringify({
          date_from: period.dateFrom,
          date_to: period.dateTo,
        }),
      });

      activeDiarySummaryId = start.id;
      const response = await fetch(`/api/diaries-summary-background?id=${encodeURIComponent(start.id)}`, {
        method: 'POST',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        let data = null;
        try {
          data = await response.json();
        } catch {}
        setDiaryProcessing(false);
        setDiaryError(data?.error || `Ошибка запуска (HTTP ${response.status})`);
        return;
      }

      setDiaryProcessing(true, 'Формирую саммари дневников...');
      pollDiarySummaryStatus(start.id, 0);
    } catch (err) {
      console.error('start diary summary error', err);
      setDiaryProcessing(false);
      setDiaryError(err.data?.error || 'Не удалось запустить саммари');
    }
  }

  async function copyDiarySummary() {
    if (!activeDiarySummaryMarkdown) return;
    try {
      await navigator.clipboard.writeText(activeDiarySummaryMarkdown);
      setStatus('Скопировано', 'saved');
    } catch {
      setStatus('Не удалось скопировать', 'error');
    }
  }

  function toggleDiaryEmailForm() {
    const form = $('#diary-email-form');
    if (!form) return;
    form.style.display = 'flex';
    smoothScrollToElement(form, 'end');
    $('#diary-email-input')?.focus();
  }

  async function sendDiarySummaryEmail() {
    const email = String($('#diary-email-input')?.value || '').trim();
    if (!/.+@.+\..+/.test(email)) {
      setDiaryError('Введите корректный email.');
      return;
    }
    if (!activeDiarySummaryId) {
      setDiaryError('Нет готового саммари для отправки.');
      return;
    }

    try {
      await api('diaries-summary-email', {
        method: 'POST',
        body: JSON.stringify({
          summary_id: activeDiarySummaryId,
          email,
          summary_text: activeDiarySummaryMarkdown,
        }),
      });
      rememberDiaryEmail(email);
      setStatus('Отправлено на email', 'saved');
      showAppModal(`Саммари дневников отправлено на ${email}.`);
    } catch (err) {
      console.error('send diary email error', err);
      setDiaryError(err.data?.error || 'Не удалось отправить email');
    }
  }

  async function openDiaryPeriod(period) {
    const dateFrom = String(period?.dateFrom || '').trim();
    const dateTo = String(period?.dateTo || '').trim();
    if (dateFrom && dateTo) {
      const preset = $('#diary-period-preset');
      if (preset) preset.value = 'custom';
      const fromInput = $('#diary-date-from');
      const toInput = $('#diary-date-to');
      if (fromInput) fromInput.value = dateFrom;
      if (toInput) toInput.value = dateTo;
      normalizeDiaryDateInputs();
      diariesLoaded = true;
    }

    await loadDiaryEntries();
    await loadLatestDiarySummary();
  }

  async function openDiaryTab() {
    if (!diariesLoaded) {
      applyDiaryPreset('7');
      normalizeDiaryDateInputs();
      diariesLoaded = true;
    }

    await loadDiaryEntries();
    await loadLatestDiarySummary();
  }

  function bindDiaryEvents() {
    const remembered = loadRememberedDiaryEmail();
    if (remembered && $('#diary-email-input')) {
      $('#diary-email-input').value = remembered;
    }

    $('#diary-period-preset')?.addEventListener('change', (event) => {
      const preset = event.target?.value || '7';
      if (preset !== 'custom') {
        applyDiaryPreset(preset);
        normalizeDiaryDateInputs();
        loadDiaryEntries();
      }
    });

    $('#diary-date-from')?.addEventListener('input', (event) => {
      const input = event.target;
      if (input) input.value = formatDiaryDateDraft(input.value);
      const preset = $('#diary-period-preset');
      if (preset) preset.value = 'custom';
    });
    $('#diary-date-from')?.addEventListener('change', () => {
      normalizeDiaryDateInput('#diary-date-from');
      const preset = $('#diary-period-preset');
      if (preset) preset.value = 'custom';
    });
    $('#diary-date-from')?.addEventListener('blur', () => {
      normalizeDiaryDateInput('#diary-date-from');
    });
    $('#diary-date-to')?.addEventListener('input', (event) => {
      const input = event.target;
      if (input) input.value = formatDiaryDateDraft(input.value);
      const preset = $('#diary-period-preset');
      if (preset) preset.value = 'custom';
    });
    $('#diary-date-to')?.addEventListener('change', () => {
      normalizeDiaryDateInput('#diary-date-to');
      const preset = $('#diary-period-preset');
      if (preset) preset.value = 'custom';
    });
    $('#diary-date-to')?.addEventListener('blur', () => {
      normalizeDiaryDateInput('#diary-date-to');
    });

    $('#btn-diary-load')?.addEventListener('click', loadDiaryEntries);
    $('#btn-diary-summarize')?.addEventListener('click', startDiarySummary);
    $('#btn-diary-copy')?.addEventListener('click', copyDiarySummary);
    $('#btn-diary-email')?.addEventListener('click', toggleDiaryEmailForm);
    $('#btn-diary-send-email')?.addEventListener('click', sendDiarySummaryEmail);
  }

  return {
    bindDiaryEvents,
    openDiaryPeriod,
    openDiaryTab,
  };
}

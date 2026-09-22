import { $, $$ } from '../core/dom.js';
import { escapeHtml } from '../core/html.js';
import { renderMarkdown } from '../core/markdown.js';

export function createConsultationsController({
  api,
  allowedUploadExtensions,
  consultEmailStorageKey,
  consultationMaxAttempts,
  consultationPollMs,
  formatDateTime,
  getCurrentState,
  getEditedSummaryText,
  hideAppModal,
  loadConsultationEditorFromSummary,
  loadVersions,
  maxUploadFileBytes,
  populateFields,
  setCurrentState,
  setStatus,
  showAppModal,
  smoothScrollToBottom,
  smoothScrollToElement,
}) {
  let consultationsLoaded = false;
  let activeConsultationId = '';
  let activeSummaryMarkdown = '';
  let activeSummaryJson = null;
  let activeSummaryType = 'one_on_one';
  let consultationHistory = [];
  let consultationPolling = null;

  function setConsultationUploadError(message) {
    const el = $('#consul-upload-error');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  }

  function setConsultationPostersError(message) {
    const el = $('#consul-posters-error');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  }

  function setConsultationProcessing(visible, text = '') {
    const box = $('#consul-processing');
    const textEl = $('#consul-processing-text');
    if (box) box.style.display = visible ? 'flex' : 'none';
    if (textEl && text) textEl.textContent = text;
  }

  function setConsultationResultVisible(visible) {
    const box = $('#consul-result');
    if (box) box.style.display = visible ? 'block' : 'none';
  }

  function getUploadExtension(file) {
    if (!file?.name) return '';
    return file.name.split('.').pop().toLowerCase();
  }

  function validateConsultationFile(file, required = false) {
    if (!file) {
      return required ? 'Загрузите файл транскрипции.' : '';
    }
    if (file.size > maxUploadFileBytes) {
      return 'Файл слишком большой (до 5 МБ).';
    }
    const ext = getUploadExtension(file);
    if (!allowedUploadExtensions.includes(ext)) {
      return 'Поддерживаются только .txt, .md и .vtt';
    }
    return '';
  }

  function formatFileMeta(file) {
    if (!file) return '';
    const sizeKb = file.size / 1024;
    const size = sizeKb > 1024
      ? `${(sizeKb / 1024).toFixed(2)} MB`
      : `${Math.round(sizeKb)} KB`;
    return `${file.name} • ${size}`;
  }

  function updateConsultationFileMeta(inputEl, outputSel) {
    const out = $(outputSel);
    if (!out) return;
    const file = inputEl?.files?.[0];
    out.textContent = formatFileMeta(file);
  }

  function rememberConsultationEmail(value) {
    if (!value) return;
    try {
      localStorage.setItem(consultEmailStorageKey, value);
    } catch {}
  }

  function loadRememberedConsultationEmail() {
    try {
      return localStorage.getItem(consultEmailStorageKey) || '';
    } catch {
      return '';
    }
  }

  function stopConsultationPolling() {
    if (consultationPolling) {
      clearTimeout(consultationPolling);
      consultationPolling = null;
    }
  }

  function consultationStatusLabel(status) {
    if (status === 'completed') return 'Готово';
    if (status === 'failed') return 'Ошибка';
    return 'Обработка';
  }

  function summaryTypeLabel(summaryType) {
    return summaryType === 'topics' ? 'Упрощённый' : 'Глубокий разбор';
  }

  function renderConsultationHistory() {
    const box = $('#consul-history');
    if (!box) return;

    if (!consultationHistory.length) {
      box.innerHTML = '<div class="consul-history-empty">Пока нет консультаций.</div>';
      return;
    }

    box.innerHTML = '';
    consultationHistory.forEach((item) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'consul-history-item lk-history-item';
      row.innerHTML = `
        <span class="title">${formatDateTime(item.created_at)}</span>
        <span class="meta">${summaryTypeLabel(item.summary_type)} · ${consultationStatusLabel(item.status)}</span>
      `;
      row.addEventListener('click', () => openConsultation(item.id));
      box.appendChild(row);
    });
  }

  async function loadConsultationHistory(force = false) {
    if (consultationsLoaded && !force) return;
    try {
      const result = await api('summarize-status');
      consultationHistory = result.items || [];
      consultationsLoaded = true;
      renderConsultationHistory();
    } catch (err) {
      console.error('consultation history error', err);
      const box = $('#consul-history');
      if (box) box.innerHTML = '<div class="consul-history-empty">Не удалось загрузить историю.</div>';
    }
  }

  function renderConsultationResult(data) {
    activeConsultationId = data.id || activeConsultationId;
    activeSummaryMarkdown = data.summary_text || '';
    activeSummaryJson = data.summary_json && typeof data.summary_json === 'object'
      ? data.summary_json
      : null;
    activeSummaryType = String(data.summary_type || 'one_on_one');
    loadConsultationEditorFromSummary(activeSummaryMarkdown);

    setConsultationUploadError('');
    setConsultationProcessing(false);
    setConsultationResultVisible(true);

    const head = $('#consul-result-head');
    if (head) {
      head.innerHTML = `
        <h3 class="text-xl font-bold text-slate-900 dark:text-slate-50">${summaryTypeLabel(data.summary_type)}</h3>
        <p class="text-slate-500 text-sm mt-1">${formatDateTime(data.created_at)}</p>
      `;
    }

    const summaryBox = $('#consul-summary-html');
    if (summaryBox) {
      summaryBox.innerHTML = renderMarkdown(activeSummaryMarkdown);
    }

    const emailInput = $('#consul-email-input');
    if (emailInput && !emailInput.value) {
      const rememberedEmail = loadRememberedConsultationEmail();
      if (rememberedEmail) {
        emailInput.value = rememberedEmail;
      } else if (getCurrentState()?.name) {
        emailInput.placeholder = `email для ${getCurrentState().name}`;
      }
    }

    const diffBox = $('#consul-diff');
    if (diffBox) {
      diffBox.style.display = 'none';
      diffBox.innerHTML = '';
    }
    const emailForm = $('#consul-email-form');
    if (emailForm) emailForm.style.display = 'none';

    const posters = $('#consul-posters');
    if (posters) posters.style.display = 'none';
    const postersList = $('#consul-posters-list');
    if (postersList) postersList.innerHTML = '';
    setConsultationPostersError('');
  }

  async function openConsultation(id) {
    if (!id) return;
    setConsultationUploadError('');
    setConsultationResultVisible(false);
    setConsultationProcessing(true, 'Загрузка консультации...');
    stopConsultationPolling();

    try {
      const result = await api(`summarize-status?id=${encodeURIComponent(id)}`);
      activeConsultationId = id;
      if (result.status === 'completed') {
        renderConsultationResult(result);
        return;
      }
      if (result.status === 'failed') {
        setConsultationProcessing(false);
        setConsultationUploadError(result.error_message || 'Не удалось обработать консультацию');
        return;
      }
      setConsultationProcessing(true, 'Обработка транскрипции...');
      pollConsultationStatus(id, 0);
    } catch (err) {
      console.error('open consultation error', err);
      setConsultationProcessing(false);
      setConsultationUploadError(err.data?.error || 'Не удалось загрузить консультацию');
    }
  }

  function pollConsultationStatus(id, attempt = 0) {
    stopConsultationPolling();
    if (attempt >= consultationMaxAttempts) {
      setConsultationProcessing(false);
      setConsultationUploadError('Обработка заняла слишком много времени. Откройте историю позже.');
      return;
    }

    consultationPolling = setTimeout(async () => {
      try {
        const result = await api(`summarize-status?id=${encodeURIComponent(id)}`);
        if (result.status === 'completed') {
          stopConsultationPolling();
          renderConsultationResult(result);
          await loadConsultationHistory(true);
          return;
        }
        if (result.status === 'failed') {
          stopConsultationPolling();
          setConsultationProcessing(false);
          setConsultationUploadError(result.error_message || 'Ошибка обработки');
          await loadConsultationHistory(true);
          return;
        }
        setConsultationProcessing(true, 'Обработка транскрипции...');
        pollConsultationStatus(id, attempt + 1);
      } catch (err) {
        console.error('poll consultation error', err);
        pollConsultationStatus(id, attempt + 1);
      }
    }, consultationPollMs);
  }

  async function handleSummarize() {
    setConsultationUploadError('');
    setConsultationPostersError('');

    const transcript = $('#consul-file')?.files?.[0];
    const notes = $('#consul-notes')?.files?.[0];
    const autoEmail = String($('#consul-email')?.value || '').trim();
    const summaryType = $('input[name="consul-summary-type"]:checked')?.value || 'one_on_one';

    const transcriptErr = validateConsultationFile(transcript, true);
    if (transcriptErr) {
      setConsultationUploadError(transcriptErr);
      return;
    }
    const notesErr = validateConsultationFile(notes, false);
    if (notesErr) {
      setConsultationUploadError(notesErr);
      return;
    }
    if (!/.+@.+\..+/.test(autoEmail)) {
      setConsultationUploadError('Введите email для авто-отправки.');
      return;
    }

    setConsultationResultVisible(false);
    setConsultationProcessing(true, 'Создаю задачу...');

    try {
      const start = await api('summarize-start', {
        method: 'POST',
        body: JSON.stringify({ summary_type: summaryType }),
      });
      const consultationId = start.id;
      activeConsultationId = consultationId;

      const formData = new FormData();
      formData.set('consultationId', consultationId);
      formData.set('summaryType', summaryType);
      formData.set('email', autoEmail);
      formData.set('transcript', transcript);
      if (notes) formData.set('notes', notes);

      rememberConsultationEmail(autoEmail);

      const response = await fetch(`/api/summarize-background?id=${encodeURIComponent(consultationId)}`, {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });

      if (!response.ok) {
        let data = null;
        try {
          data = await response.json();
        } catch {}
        setConsultationProcessing(false);
        setConsultationUploadError(data?.error || `Ошибка запуска (HTTP ${response.status})`);
        return;
      }

      setConsultationProcessing(true, 'Обработка транскрипции...');
      pollConsultationStatus(consultationId, 0);
      loadConsultationHistory(true);
    } catch (err) {
      console.error('summarize start error', err);
      setConsultationProcessing(false);
      setConsultationUploadError(err.data?.error || 'Ошибка сети. Попробуйте снова.');
    }
  }

  function setConsultationApplyStatus(message = '', state = '') {
    const statusEl = $('#consul-apply-local-status');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.state = state;
  }

  function renderConsultationDiff(preview) {
    const box = $('#consul-diff');
    if (!box) return;

    const groups = (preview?.groups || []).filter((group) => group.changed_count > 0);
    const diffRows = (preview?.diff || []).filter((item) => item.changed);

    if (diffRows.length === 0) {
      box.style.display = 'block';
      box.innerHTML = '<div class="consul-diff-empty">Изменений для применения нет.</div>';
      return;
    }

    const groupHtml = groups.map((group, idx) => `
      <label class="consul-diff-group">
        <input type="checkbox" class="consul-group-check" data-fields="${group.changed_fields.join(',')}" ${idx === 0 || group.changed_count > 0 ? 'checked' : ''}>
        <span>${escapeHtml(group.label)} (${group.changed_count})</span>
      </label>
    `).join('');

    const diffHtml = diffRows.map((row) => `
      <div class="consul-diff-row">
        <div class="field">${escapeHtml(row.label || row.key)}</div>
        <div class="old">${escapeHtml((row.old_value || '').slice(0, 200)) || '—'}</div>
        <div class="new">${escapeHtml((row.new_value || '').slice(0, 200)) || '—'}</div>
      </div>
    `).join('');

    box.style.display = 'block';
    box.innerHTML = `
      <div class="consul-diff-head">Предпросмотр перезаписи полей</div>
      <div class="consul-diff-groups">${groupHtml}</div>
      <div class="consul-diff-legend">
        <span>Было</span>
        <span>Станет</span>
      </div>
      <div class="consul-diff-table">${diffHtml}</div>
      <div class="consul-apply-actions">
        <button type="button" id="btn-consul-apply-confirm" class="px-6 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-all shadow-md shadow-primary/20 mt-2">Подтвердить применение</button>
        <span id="consul-apply-local-status" class="consul-apply-status" role="status" aria-live="polite"></span>
      </div>
    `;

    const applyBtn = $('#btn-consul-apply-confirm');
    if (applyBtn) {
      applyBtn.addEventListener('click', submitConsultationApply);
    }
  }

  function collectSelectedApplyFields() {
    const checks = $$('#consul-diff .consul-group-check:checked');
    const set = new Set();
    checks.forEach((check) => {
      const fields = String(check.dataset.fields || '')
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);
      fields.forEach((field) => set.add(field));
    });
    return Array.from(set);
  }

  async function previewConsultationApply() {
    if (!activeConsultationId) return;
    setConsultationUploadError('');
    try {
      const result = await api('summarize-apply', {
        method: 'POST',
        body: JSON.stringify({
          consultation_id: activeConsultationId,
          preview: true,
        }),
      });
      renderConsultationDiff(result.preview);
      smoothScrollToElement($('#consul-diff'));
    } catch (err) {
      console.error('apply preview error', err);
      setConsultationUploadError(err.data?.error || 'Не удалось построить diff');
    }
  }

  async function submitConsultationApply() {
    if (!activeConsultationId) return;
    const selectedFields = collectSelectedApplyFields();
    if (selectedFields.length === 0) {
      setConsultationUploadError('Выберите хотя бы одну группу полей.');
      setConsultationApplyStatus('Выберите хотя бы одну группу полей.', 'error');
      return;
    }

    const applyBtn = $('#btn-consul-apply-confirm');
    if (applyBtn) applyBtn.disabled = true;
    setConsultationApplyStatus('Применяю саммари...', 'saving');
    setStatus('Применяю саммари...', 'saving');
    try {
      const result = await api('summarize-apply', {
        method: 'POST',
        body: JSON.stringify({
          consultation_id: activeConsultationId,
          selected_fields: selectedFields,
        }),
      });

      if (result.data) {
        setCurrentState(result.data);
        populateFields(result.data);
      }

      setStatus('Саммари применено', 'saved');
      setConsultationApplyStatus('Саммари применено', 'saved');
      window.setTimeout(() => {
        const box = $('#consul-diff');
        if (box) box.style.display = 'none';
      }, 1200);
      loadVersions();
    } catch (err) {
      console.error('apply error', err);
      const message = err.data?.error || 'Ошибка применения саммари';
      setStatus(message, 'error');
      setConsultationApplyStatus(message, 'error');
      if (applyBtn) applyBtn.disabled = false;
    }
  }

  function downloadConsultationSummary() {
    const summary = getEditedSummaryText();
    if (!summary) return;
    const fileName = `summary-${new Date().toISOString().slice(0, 10)}.md`;
    const blob = new Blob([summary], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyConsultationSummary() {
    const summary = getEditedSummaryText();
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setStatus('Скопировано', 'saved');
    } catch {
      setStatus('Не удалось скопировать', 'error');
    }
  }

  function toggleConsultationEmailForm() {
    const form = $('#consul-email-form');
    if (!form) return;
    form.style.display = 'flex';
    smoothScrollToElement(form, 'end');
    smoothScrollToBottom();
    $('#consul-email-input')?.focus();
  }

  async function sendConsultationEmail() {
    if (!activeConsultationId) return;
    const email = String($('#consul-email-input')?.value || '').trim();
    if (!/.+@.+\..+/.test(email)) {
      setConsultationUploadError('Введите корректный email.');
      return;
    }
    setConsultationUploadError('');

    try {
      await api('summarize-email', {
        method: 'POST',
        body: JSON.stringify({
          consultation_id: activeConsultationId,
          email,
          summary_text: getEditedSummaryText(),
        }),
      });
      rememberConsultationEmail(email);
      setStatus('Отправлено на email', 'saved');
      showAppModal(`Саммари отправлено на ${email}.`);
    } catch (err) {
      console.error('send email error', err);
      setConsultationUploadError(err.data?.error || 'Не удалось отправить email');
    }
  }

  function renderPosterCards(prompts) {
    const box = $('#consul-posters-list');
    if (!box) return;

    box.innerHTML = '';
    prompts.forEach((prompt, idx) => {
      const card = document.createElement('div');
      card.className = 'consul-poster-card';
      card.innerHTML = `
        <div class="head">
          <strong>Вариант ${idx + 1}</strong>
          <button type="button" class="action-btn text-xs">Копировать</button>
        </div>
        <p>${escapeHtml(prompt)}</p>
      `;

      const copyBtn = card.querySelector('button');
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(prompt);
          copyBtn.textContent = 'Скопировано';
          setTimeout(() => { copyBtn.textContent = 'Копировать'; }, 1200);
        } catch {
          copyBtn.textContent = 'Ошибка';
          setTimeout(() => { copyBtn.textContent = 'Копировать'; }, 1200);
        }
      });
      box.appendChild(card);
    });
  }

  async function requestPosterPrompts() {
    if (!activeConsultationId) return;
    setConsultationPostersError('');
    const posters = $('#consul-posters');
    if (posters) posters.style.display = 'block';
    const list = $('#consul-posters-list');
    if (list) {
      list.innerHTML = `
        <div class="consul-posters-loading">
          <div class="spinner"></div>
          <span>Генерирую промпты...</span>
        </div>
      `;
    }
    smoothScrollToElement(posters, 'end');
    smoothScrollToBottom();

    try {
      const result = await api('poster-prompt', {
        method: 'POST',
        body: JSON.stringify({
          consultation_id: activeConsultationId,
          summary_text: getEditedSummaryText(),
          summary_json: activeSummaryJson,
          summary_type: activeSummaryType,
        }),
      });
      renderPosterCards(result.prompts || []);
    } catch (err) {
      console.error('poster prompt error', err);
      if (list) list.innerHTML = '';
      const fallbackMessage = err.status && err.status >= 500
        ? 'Сервер не успел завершить генерацию плакатов. Попробуйте снова.'
        : 'Не удалось сгенерировать промпты';
      setConsultationPostersError(err.data?.error || fallbackMessage);
    }
  }

  function bindConsultationEvents({
    handleConsultEditorClick,
    resetConsultationEditor,
  }) {
    const savedEmail = loadRememberedConsultationEmail();
    if (savedEmail && $('#consul-email')) {
      $('#consul-email').value = savedEmail;
    }
    $('#consul-file')?.addEventListener('change', () => {
      updateConsultationFileMeta($('#consul-file'), '#consul-file-meta');
    });
    $('#consul-notes')?.addEventListener('change', () => {
      updateConsultationFileMeta($('#consul-notes'), '#consul-notes-meta');
    });
    $('#btn-summarize')?.addEventListener('click', handleSummarize);
    $('#btn-apply')?.addEventListener('click', previewConsultationApply);
    $('#btn-download')?.addEventListener('click', downloadConsultationSummary);
    $('#btn-copy')?.addEventListener('click', copyConsultationSummary);
    $('#btn-email')?.addEventListener('click', toggleConsultationEmailForm);
    $('#btn-send-email')?.addEventListener('click', sendConsultationEmail);
    $('#btn-posters')?.addEventListener('click', requestPosterPrompts);
    $('#app-modal-ok')?.addEventListener('click', hideAppModal);
    $('#app-modal')?.addEventListener('click', (event) => {
      if (event.target?.id === 'app-modal') {
        hideAppModal();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideAppModal();
      }
    });
    $('#consul-editor-list')?.addEventListener('click', handleConsultEditorClick);
    $('#btn-consul-reset-editor')?.addEventListener('click', resetConsultationEditor);
  }

  return {
    bindConsultationEvents,
    loadConsultationHistory,
    openConsultation,
  };
}

import { $ } from '../core/dom.js';
import { escapeHtml } from '../core/html.js';

const LINK_EDITOR_EMPTY_STATE = {
  stimulus: '',
  reaction: '',
  old_belief: '',
  new_belief: '',
  new_actions: '',
  status: 'active',
  slot_no: '',
};

export function createLinksController({
  api,
  formatDateTime,
  setStatus,
  showAppModal,
  showToast,
  smoothScrollToElement,
}) {
  let linksLoaded = false;
  let activeLinks = [];
  let inactiveLinks = [];
  let linkSuggestions = [];
  let linksReport = null;
  let editingLinkId = '';
  let linksSignalsBootstrapped = false;

  function setLinksError(message) {
    const el = $('#links-error');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  }

  function setLinkEditorError(message) {
    const el = $('#link-editor-error');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  }

  function getLinkEditorModal() {
    return $('#link-editor-modal');
  }

  function isLinkEditorOpen() {
    return getLinkEditorModal()?.getAttribute('aria-hidden') === 'false';
  }

  function fillLinkEditorForm(values = {}) {
    $('#link-form-stimulus').value = values.stimulus || '';
    $('#link-form-reaction').value = values.reaction || '';
    $('#link-form-old-belief').value = values.old_belief || '';
    $('#link-form-new-belief').value = values.new_belief || '';
    $('#link-form-new-actions').value = values.new_actions || '';
    $('#link-form-status').value = values.status || 'active';
    $('#link-form-slot').value = values.slot_no || '';
  }

  function resetLinkEditorForm() {
    editingLinkId = '';
    fillLinkEditorForm(LINK_EDITOR_EMPTY_STATE);
    setLinkEditorError('');
  }

  function openLinkEditor(link) {
    if (!link) return;
    editingLinkId = link.id;
    fillLinkEditorForm(link);
    setLinkEditorError('');
    const modal = getLinkEditorModal();
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    $('#link-editor-title').textContent = 'Редактировать связку';
    requestAnimationFrame(() => {
      $('#link-form-stimulus')?.focus();
    });
  }

  function closeLinkEditor() {
    const modal = getLinkEditorModal();
    if (modal) {
      modal.setAttribute('aria-hidden', 'true');
    }
    resetLinkEditorForm();
  }

  function readLinkEditorPayload() {
    return {
      id: editingLinkId || undefined,
      stimulus: String($('#link-form-stimulus')?.value || '').trim(),
      reaction: String($('#link-form-reaction')?.value || '').trim(),
      old_belief: String($('#link-form-old-belief')?.value || '').trim(),
      new_belief: String($('#link-form-new-belief')?.value || '').trim(),
      new_actions: String($('#link-form-new-actions')?.value || '').trim(),
      status: String($('#link-form-status')?.value || 'active').trim(),
      slot_no: String($('#link-form-slot')?.value || '').trim(),
    };
  }

  function findLinkById(id) {
    return [...activeLinks, ...inactiveLinks].find((item) => item.id === id) || null;
  }

  function isPublishedLink(id) {
    return String(linksReport?.active_link?.id || '') === String(id || '');
  }

  function showLinksToast(message, options = {}) {
    showToast?.(message, options);
  }

  function getStatusLabel(status) {
    return status === 'active' ? 'В работе' : 'В архиве';
  }

  function getSuggestionTypeLabel(type) {
    if (type === 'progress_match') return 'Похоже на прогресс';
    if (type === 'new_link') return 'Похоже на новую связку';
    return 'Сигнал без действия';
  }

  function getFocusLinkId() {
    return String(linksReport?.active_link?.id || '').trim();
  }

  function getFocusLinkCard() {
    const focusLinkId = getFocusLinkId();
    if (!focusLinkId) return null;
    return [...activeLinks, ...inactiveLinks].find((item) => String(item.id) === focusLinkId) || null;
  }

  function getConfirmedProgressCount(linkId) {
    if (!linkId) return 0;
    const reportItem = Array.isArray(linksReport?.links)
      ? linksReport.links.find((item) => String(item.id) === String(linkId))
      : null;
    return Number(reportItem?.progress_events || 0);
  }

  function getMetricWidth(value, maxValue) {
    if (!value) return 0;
    return Math.max(6, Math.round((value / maxValue) * 100));
  }

  function renderMetricRow(label, value, barClass, maxValue) {
    return `
      <div class="space-y-1">
        <div class="flex justify-between gap-3"><span>${escapeHtml(label)}</span><span>${value}</span></div>
        <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div class="h-full ${barClass}" style="width:${getMetricWidth(value, maxValue)}%"></div>
        </div>
      </div>
    `;
  }

  function renderLinkSections(link) {
    return `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div><span class="font-semibold">Стимул:</span><br>${escapeHtml(link.stimulus || '')}</div>
        <div><span class="font-semibold">Реакция:</span><br>${escapeHtml(link.reaction || '')}</div>
        <div><span class="font-semibold">Старое понимание:</span><br>${escapeHtml(link.old_belief || '')}</div>
        <div><span class="font-semibold">Новое понимание:</span><br>${escapeHtml(link.new_belief || '')}</div>
      </div>
      <div class="text-sm"><span class="font-semibold">Новые действия:</span><br>${escapeHtml(link.new_actions || '')}</div>
    `;
  }

  function renderLinkCard(link, { active = false } = {}) {
    const slot = link.slot_no
      ? `<span class="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">Slot ${link.slot_no}</span>`
      : '';
    const published = isPublishedLink(link.id)
      ? '<span class="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">В фокусе</span>'
      : '';
    const publishLabel = isPublishedLink(link.id) ? 'Обновить фокус' : 'Сделать фокусом';

    return `
      <article class="lk-link-card rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-4 space-y-3">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <strong class="text-sm">${escapeHtml(link.new_belief || link.stimulus || 'Связка')}</strong>
              ${slot}
              ${published}
              <span class="text-xs text-slate-500 dark:text-slate-400">${getStatusLabel(link.status)}</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">${formatDateTime(link.updated_at || link.created_at)}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="action-btn" data-link-action="edit" data-link-id="${link.id}"><span class="material-symbols-outlined text-base">edit</span> Редактировать</button>
            ${active ? `<button class="action-btn" data-link-action="publish" data-link-id="${link.id}"><span class="material-symbols-outlined text-base">publish</span> ${publishLabel}</button>` : ''}
            ${active ? `<button class="action-btn" data-link-action="progress" data-link-id="${link.id}"><span class="material-symbols-outlined text-base">task_alt</span> Подтвердить прогресс</button>` : ''}
            <button class="action-btn" data-link-action="${active ? 'deactivate' : 'activate'}" data-link-id="${link.id}">
              <span class="material-symbols-outlined text-base">${active ? 'archive' : 'unarchive'}</span>
              ${active ? 'В архив' : 'Вернуть в работу'}
            </button>
          </div>
        </div>
        ${renderLinkSections(link)}
      </article>
    `;
  }

  function renderFocusCard(activeLink, focusLinkRecord) {
    const slot = activeLink.slot_no
      ? `<span class="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">Slot ${activeLink.slot_no}</span>`
      : '';
    const autoProgress = Number(activeLink.overall_progress || 0);
    const confirmedProgress = Number(activeLink.confirmed_progress || getConfirmedProgressCount(activeLink.id));

    return `
      <article class="lk-link-card lk-link-card-focus rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-slate-50/80 dark:bg-slate-800/60 space-y-5">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="space-y-2 max-w-4xl">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="text-base font-semibold">${escapeHtml(activeLink.title || focusLinkRecord?.new_belief || 'Связка')}</h4>
              <span class="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">В фокусе</span>
              <span class="text-xs text-slate-500 dark:text-slate-400">В работе</span>
              ${slot}
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400">Эта карточка является источником истины для Summary, Базовых и переменной ситуации.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="action-btn" data-link-action="edit" data-link-id="${activeLink.id}"><span class="material-symbols-outlined text-base">edit</span> Редактировать</button>
            <button class="action-btn" data-link-action="progress" data-link-id="${activeLink.id}"><span class="material-symbols-outlined text-base">task_alt</span> Подтвердить прогресс</button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="lk-metric-card rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/30 px-4 py-3">
            <div class="text-xs uppercase tracking-[0.16em] text-slate-400">Сигналы по фокусу</div>
            <div class="mt-2 text-3xl font-black leading-none text-primary">${autoProgress}</div>
            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Автоматический счётчик входящих успехов, новых связок и идей, пока эта связка находится в фокусе.</p>
          </div>
          <div class="lk-metric-card rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/30 px-4 py-3">
            <div class="text-xs uppercase tracking-[0.16em] text-slate-400">Подтверждения</div>
            <div class="mt-2 text-3xl font-black leading-none text-emerald-500">${confirmedProgress}</div>
            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Ручные и AI-подтверждённые попадания сигналов именно в эту связку.</p>
          </div>
        </div>
        ${renderLinkSections(activeLink)}
      </article>
    `;
  }

  function renderLinksLists() {
    const activeList = $('#links-active-list');
    const inactiveList = $('#links-inactive-list');
    const activeCountEl = $('#links-active-count');
    const inactiveCountEl = $('#links-inactive-count');
    const meta = $('#links-meta');
    const focusLinkId = getFocusLinkId();
    const workingLinks = activeLinks.filter((item) => String(item.id) !== focusLinkId);

    if (meta) meta.textContent = `В работе: ${activeLinks.length} / 10 · в архиве: ${inactiveLinks.length}`;
    if (activeCountEl) activeCountEl.textContent = `${workingLinks.length} шт.`;
    if (inactiveCountEl) inactiveCountEl.textContent = `${inactiveLinks.length} шт.`;

    if (activeList) {
      activeList.innerHTML = workingLinks.length
        ? workingLinks.map((link) => renderLinkCard(link, { active: true })).join('')
        : '<div class="diary-empty">Других рабочих связок пока нет.</div>';
    }
    if (inactiveList) {
      inactiveList.innerHTML = inactiveLinks.length
        ? inactiveLinks.map((link) => renderLinkCard(link, { active: false })).join('')
        : '<div class="diary-empty">Неактивных связок пока нет.</div>';
    }
  }

  async function loadLinks(force = false) {
    if (linksLoaded && !force) return;
    try {
      const result = await api('links');
      activeLinks = result.active_items || [];
      inactiveLinks = result.inactive_items || [];
      linksLoaded = true;
      renderLinksLists();
      setLinksError('');
    } catch (err) {
      console.error('load links error', err);
      setLinksError(err.data?.error || 'Не удалось загрузить связки');
    }
  }

  function renderLinkSuggestions() {
    const list = $('#link-suggestions-list');
    const meta = $('#link-suggestions-meta');
    if (!list) return;

    if (meta) {
      meta.textContent = linkSuggestions.length
        ? `Ожидают разбора: ${linkSuggestions.length}`
        : 'Новых предложений нет';
    }
    if (!linkSuggestions.length) {
      list.innerHTML = '<div class="diary-empty">Новых AI-предложений нет.</div>';
      return;
    }

    list.innerHTML = linkSuggestions.map((item) => {
      const suggested = item.suggested_link_id
        ? `<p class="text-xs text-slate-500 dark:text-slate-400">Похоже на связку: ${escapeHtml(item.new_belief || item.stimulus || item.suggested_link_id)}</p>`
        : '';
      const candidate = item.extracted_payload?.candidate_link
        ? `
          <div class="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div><strong>Кандидат: стимул.</strong> ${escapeHtml(item.extracted_payload.candidate_link.stimulus || '—')}</div>
            <div><strong>Кандидат: новое понимание.</strong> ${escapeHtml(item.extracted_payload.candidate_link.new_belief || '—')}</div>
          </div>
        `
        : '';

      return `
        <article class="lk-suggestion-card rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-4 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <strong class="text-sm">${escapeHtml(getSuggestionTypeLabel(item.suggestion_type))}</strong>
                <span class="text-xs text-slate-500 dark:text-slate-400">${Math.round(Number(item.confidence || 0) * 100)}%</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(item.source_type || 'source')} · ${formatDateTime(item.created_at)}</p>
            </div>
          </div>
          <div class="text-sm whitespace-pre-wrap">${escapeHtml(item.signal_text || '')}</div>
          ${suggested}
          ${item.rationale ? `<div class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(item.rationale)}</div>` : ''}
          ${candidate}
          <div class="flex flex-wrap gap-2">
            <button class="action-btn" data-suggestion-action="accept_progress" data-suggestion-id="${item.id}"><span class="material-symbols-outlined text-base">task_alt</span> Подтвердить попадание</button>
            <button class="action-btn" data-suggestion-action="create_new_link" data-suggestion-id="${item.id}"><span class="material-symbols-outlined text-base">add_circle</span> Создать новую связку</button>
            <button class="action-btn" data-suggestion-action="ignore" data-suggestion-id="${item.id}"><span class="material-symbols-outlined text-base">block</span> Не учитывать</button>
          </div>
        </article>
      `;
    }).join('');
  }

  async function loadLinkSuggestions() {
    try {
      const result = await api('link-suggestions?status=pending&limit=30');
      linkSuggestions = result.items || [];
      renderLinkSuggestions();
      setLinksError('');
    } catch (err) {
      console.error('load link suggestions error', err);
      setLinksError(err.data?.error || 'Не удалось загрузить сигналы на разбор');
    }
  }

  function renderActiveLinkOverall() {
    const overall = $('#links-report-overall');
    if (!overall) return;

    const activeLink = linksReport?.active_link || null;
    const focusLinkRecord = getFocusLinkCard();
    if (!activeLink || !String(activeLink.id || '').trim() || !focusLinkRecord) {
      overall.innerHTML = '<div class="diary-empty">Связка в фокусе появится после применения саммари или после выбора рабочей связки.</div>';
      return;
    }

    overall.innerHTML = renderFocusCard(activeLink, focusLinkRecord);
  }

  function renderLinksReport() {
    const chart = $('#links-report-chart');
    const top = $('#links-report-top');
    if (!chart || !top) return;

    if (!linksReport || !Array.isArray(linksReport.weeks)) {
      chart.innerHTML = '<div class="diary-empty">Нет данных отчёта.</div>';
      renderActiveLinkOverall();
      top.innerHTML = '';
      return;
    }

    const maxValue = Math.max(
      1,
      ...linksReport.weeks.map((item) => Math.max(item.successes || 0, item.new_links || 0, item.ideas || 0))
    );

    chart.innerHTML = `
      <div class="space-y-3">
        <h4 class="text-sm font-semibold">Активность за период</h4>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          ${linksReport.weeks.map((week) => `
            <div class="lk-report-card space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <strong class="text-sm">${escapeHtml(week.week_start)}</strong>
              <div class="space-y-2 text-xs">
                ${renderMetricRow('Успехи', Number(week.successes || 0), 'bg-primary', maxValue)}
                ${renderMetricRow('Новые связки', Number(week.new_links || 0), 'bg-emerald-400', maxValue)}
                ${renderMetricRow('Идеи', Number(week.ideas || 0), 'bg-amber-400', maxValue)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    renderActiveLinkOverall();

    const topLinks = Array.isArray(linksReport.links) ? linksReport.links.slice(0, 5) : [];
    top.innerHTML = topLinks.length
      ? `
        <div class="space-y-2">
          <h4 class="text-sm font-semibold">Топ по подтверждениям</h4>
          ${topLinks.map((item) => `
            <div class="lk-report-card flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm">
              <span>${escapeHtml(item.title || 'Связка')}</span>
              <span class="text-slate-500 dark:text-slate-400">${item.progress_events} подтвержд.</span>
            </div>
          `).join('')}
        </div>
      `
      : '<div class="diary-empty">Пока нет подтверждений по связкам.</div>';
  }

  async function loadLinksReport() {
    try {
      const period = String($('#links-report-period')?.value || '8w');
      linksReport = await api(`links-progress-report?period=${encodeURIComponent(period)}`);
      renderLinksReport();
      renderLinksLists();
      setLinksError('');
    } catch (err) {
      console.error('load links report error', err);
      setLinksError(err.data?.error || 'Не удалось загрузить отчёт по связкам');
    }
  }

  async function processLinkSignals(showSuccess = false) {
    try {
      const result = await api('link-signals-process', {
        method: 'POST',
        body: JSON.stringify({ limit: 5 }),
      });
      await loadLinkSuggestions();
      await loadLinksReport();
      if (Array.isArray(result.failures) && result.failures.length) {
        setLinksError(`Часть сигналов не обработана: ${result.failures.length}. Повтори позже.`);
        if (showSuccess) {
          setStatus('Сигналы обновлены частично', 'saving');
        }
        return;
      }
      if (showSuccess) {
        setStatus('Сигналы обновлены', 'saved');
      }
    } catch (err) {
      console.error('process link signals error', err);
      if (showSuccess) {
        setLinksError(err.data?.error || 'Не удалось обработать новые сигналы');
      }
    }
  }

  async function saveLinkEditor() {
    if (!editingLinkId) {
      setLinkEditorError('Для редактирования выбери существующую связку.');
      return;
    }

    setLinkEditorError('');
    const payload = readLinkEditorPayload();
    try {
      await api('links', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      closeLinkEditor();
      await loadLinks(true);
      await loadLinksReport();
      setStatus('Связка сохранена', 'saved');
    } catch (err) {
      console.error('save link editor error', err);
      setLinkEditorError(err.data?.error || 'Не удалось сохранить связку');
    }
  }

  async function updateLinkStatus(id, status) {
    try {
      setStatus(status === 'active' ? 'Возвращаю связку в работу...' : 'Переношу связку в архив...', 'saving');
      await api('links', {
        method: 'PATCH',
        body: JSON.stringify({ id, status }),
      });
      await loadLinks(true);
      await loadLinksReport();
      setStatus(status === 'active' ? 'Связка возвращена в работу' : 'Связка перенесена в архив', 'saved');
    } catch (err) {
      console.error('update link status error', err);
      setStatus(err.data?.error || 'Не удалось обновить статус связки', 'error');
      setLinksError(err.data?.error || 'Не удалось обновить статус связки');
    }
  }

  async function publishLink(id) {
    try {
      setStatus('Обновляю связку в фокусе...', 'saving');
      await api('links-publish', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
      await loadLinks(true);
      await loadLinksReport();
      renderLinksLists();
      setStatus('Связка в фокусе обновлена', 'saved');
      showAppModal('Связка синхронизирована с Summary, Базовыми и переменной ситуации.');
    } catch (err) {
      console.error('publish link error', err);
      setStatus(err.data?.error || 'Не удалось обновить переменную', 'error');
      setLinksError(err.data?.error || 'Не удалось обновить переменную');
    }
  }

  async function addManualProgress(id) {
    const note = prompt('Короткая заметка о подтверждении по этой связке:') || '';
    try {
      setStatus('Фиксирую подтверждение...', 'saving');
      await api('links-progress-event', {
        method: 'POST',
        body: JSON.stringify({ link_id: id, note }),
      });
      await loadLinksReport();
      setStatus('Подтверждение сохранено', 'saved');
      if (isPublishedLink(id)) {
        showLinksToast(
          'Подтверждение сохранено для связки в фокусе. Оно учитывается в блоке подтверждений и в аналитике.',
          { title: 'Подтверждение сохранено', type: 'success' }
        );
      } else {
        showLinksToast(
          'Подтверждение записано в историю этой связки и учтено в аналитике.',
          { title: 'Подтверждение сохранено', type: 'success' }
        );
      }
    } catch (err) {
      console.error('manual progress error', err);
      setStatus(err.data?.error || 'Не удалось сохранить подтверждение', 'error');
      setLinksError(err.data?.error || 'Не удалось сохранить подтверждение');
    }
  }

  async function resolveLinkSuggestion(id, action) {
    try {
      setStatus('Обрабатываю предложение...', 'saving');
      const result = await api('link-suggestions-resolve', {
        method: 'POST',
        body: JSON.stringify({
          suggestion_id: id,
          action,
        }),
      });
      await loadLinks(true);
      await loadLinkSuggestions();
      await loadLinksReport();
      setStatus('Предложение обработано', 'saved');
      if (action === 'accept_progress') {
        const matchedCurrentLink = isPublishedLink(result.progress_event?.link_id);
        if (matchedCurrentLink) {
          showLinksToast(
            'Сигнал подтверждён и привязан к связке в фокусе. Он попадёт в блок подтверждений и в аналитику.',
            { title: 'Попадание подтверждено', type: 'success' }
          );
        } else {
          showLinksToast(
            'Сигнал подтверждён и привязан к связке. Он отразится в подтверждениях и в аналитике.',
            { title: 'Попадание подтверждено', type: 'success' }
          );
        }
        return;
      }
      if (action === 'create_new_link') {
        const destination = result.item?.status === 'active' ? 'рабочих' : 'архивных';
        showLinksToast(
          `Новая связка создана и добавлена в список ${destination} связок. Её можно открыть и отредактировать ниже.`,
          { title: 'Новая связка создана', type: 'success' }
        );
        return;
      }
      if (action === 'ignore') {
        showLinksToast(
          'Сигнал убран из очереди и помечен как не требующий действия.',
          { title: 'Сигнал скрыт', type: 'info' }
        );
      }
    } catch (err) {
      console.error('resolve link suggestion error', err);
      setStatus(err.data?.error || 'Не удалось обработать предложение', 'error');
      setLinksError(err.data?.error || 'Не удалось обработать предложение');
    }
  }

  async function openLinksTab() {
    await loadLinks(true);
    await loadLinkSuggestions();
    await loadLinksReport();

    if (!linksSignalsBootstrapped) {
      linksSignalsBootstrapped = true;
      processLinkSignals(false);
    }
  }

  async function handleLinkAction(event) {
    const button = event.target.closest('[data-link-action]');
    if (!button) return;
    const action = button.dataset.linkAction;
    const id = button.dataset.linkId;
    const link = findLinkById(id);
    if (!link) return;

    if (action === 'edit') {
      openLinkEditor(link);
      smoothScrollToElement($('#tab-links'), 'start');
      return;
    }
    if (action === 'publish') {
      await publishLink(id);
      return;
    }
    if (action === 'progress') {
      await addManualProgress(id);
      return;
    }
    if (action === 'deactivate') {
      await updateLinkStatus(id, 'inactive');
      return;
    }
    if (action === 'activate') {
      await updateLinkStatus(id, 'active');
    }
  }

  function bindLinkEditorEvents() {
    $('#btn-link-save')?.addEventListener('click', saveLinkEditor);
    $('#btn-link-editor-cancel')?.addEventListener('click', closeLinkEditor);
    $('#btn-link-editor-close')?.addEventListener('click', closeLinkEditor);
    getLinkEditorModal()?.addEventListener('click', (event) => {
      if (event.target?.id === 'link-editor-modal') {
        closeLinkEditor();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isLinkEditorOpen()) {
        closeLinkEditor();
      }
    });
  }

  function bindLinksEvents() {
    $('#btn-link-process-signals')?.addEventListener('click', () => processLinkSignals(true));
    $('#btn-links-refresh-report')?.addEventListener('click', loadLinksReport);
    $('#links-report-overall')?.addEventListener('click', handleLinkAction);
    $('#links-active-list')?.addEventListener('click', handleLinkAction);
    $('#links-inactive-list')?.addEventListener('click', handleLinkAction);
    $('#link-suggestions-list')?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-suggestion-action]');
      if (!button) return;
      const action = button.dataset.suggestionAction;
      const id = button.dataset.suggestionId;
      await resolveLinkSuggestion(id, action);
    });
    bindLinkEditorEvents();
  }

  return {
    bindLinksEvents,
    openLinksTab,
  };
}

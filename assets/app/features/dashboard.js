import { $ } from '../core/dom.js';
import { escapeHtml } from '../core/html.js';
import {
  buildDashboardViewModel,
  deriveDashboardPeriod,
  getTodayYmd,
} from './dashboard-model.mjs';

const DASHBOARD_SOURCE_LABELS = {
  state: 'переменные',
  consultations: 'summary',
  diaries: 'дневники',
  links: 'связки',
  suggestions: 'сигналы',
  linksReport: 'аналитика связок',
  razborHistory: 'разборы',
  retroStatus: 'ретро',
};

const SEGMENT_CLASSES = {
  diaries: 'dashboard-segment-diaries',
  successes: 'dashboard-segment-successes',
  signals: 'dashboard-segment-signals',
  newLinks: 'dashboard-segment-links',
  razbor: 'dashboard-segment-razbor',
  confirmations: 'dashboard-segment-confirmations',
};

function resultValue(result, fallback) {
  return result?.status === 'fulfilled' ? result.value : fallback;
}

function resultError(result) {
  return result?.status === 'rejected' ? result.reason : null;
}

function mapErrors(resultsByKey) {
  return Object.entries(resultsByKey).reduce((errors, [key, result]) => {
    const err = resultError(result);
    if (err) {
      errors[key] = err?.data?.error || err?.message || 'Не удалось загрузить';
    }
    return errors;
  }, {});
}

function setHtml(selector, html) {
  const el = $(selector);
  if (el) el.innerHTML = html;
}

function setText(selector, text) {
  const el = $(selector);
  if (el) el.textContent = text;
}

function truncate(value, limit = 220) {
  const text = String(value || '').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function pluralize(value, one, few, many) {
  const abs = Math.abs(Number(value) || 0);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function renderField(label, value) {
  const text = String(value || '').trim();
  return `
    <div class="dashboard-context-field rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 px-4 py-3">
      <div class="text-xs uppercase tracking-[0.14em] text-slate-400">${escapeHtml(label)}</div>
      <p class="mt-2 text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-200">${escapeHtml(text || 'Не задано')}</p>
    </div>
  `;
}

function renderDashboardErrors(errors = {}) {
  const entries = Object.entries(errors);
  if (!entries.length) {
    setHtml('#dashboard-errors', '');
    return;
  }
  setHtml('#dashboard-errors', entries.map(([key, message]) => `
    <div class="inline-error" style="display:block">
      Не удалось загрузить ${escapeHtml(DASHBOARD_SOURCE_LABELS[key] || key)}: ${escapeHtml(message)}
    </div>
  `).join(''));
}

function renderFocusDetail(label, value, extraClass = '') {
  if (!value) return '';
  const className = ['dashboard-focus-detail', extraClass].filter(Boolean).join(' ');
  return `
    <div class="${className}">
      <span class="dashboard-focus-detail-label">${escapeHtml(label)}</span>
      <p class="dashboard-focus-detail-text">${escapeHtml(value)}</p>
    </div>
  `;
}

export function renderFocusCard(viewModel) {
  const focus = viewModel.focus;
  if (focus.isEmpty) {
    return `
      <div class="space-y-3">
        <p class="text-xs uppercase tracking-[0.18em] text-primary font-bold">Сейчас в работе</p>
        <h3 class="dashboard-focus-title">Связка в фокусе не выбрана</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">Фокус появится после применения summary или выбора рабочей связки во вкладке «Связки».</p>
      </div>
    `;
  }

  const bodyParts = [
    renderFocusDetail('Стимул', focus.stimulus),
    renderFocusDetail('Реакция', focus.reaction),
    renderFocusDetail('Старое понимание', focus.oldBelief),
    renderFocusDetail('Новое понимание', focus.newBelief),
    renderFocusDetail('Новое действие', focus.newActions, 'md:col-span-2'),
  ].filter(Boolean);

  return `
    <div class="space-y-5">
      <div class="space-y-2">
        <p class="text-xs uppercase tracking-[0.18em] text-primary font-bold">Сейчас в работе</p>
        <h3 class="dashboard-focus-title">${escapeHtml(focus.title)}</h3>
        ${focus.text && !bodyParts.length ? `<p class="dashboard-focus-copy">${escapeHtml(truncate(focus.text, 420))}</p>` : ''}
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="dashboard-stat">
          <span>Сигналы по фокусу</span>
          <strong>${focus.signals}</strong>
        </div>
        <div class="dashboard-stat">
          <span>Подтверждения</span>
          <strong>${focus.confirmations}</strong>
        </div>
      </div>
      ${bodyParts.length ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">${bodyParts.join('')}</div>` : ''}
    </div>
  `;
}

function renderProgressBar(segments = []) {
  const active = segments.filter((item) => item.value > 0);
  if (!active.length) {
    return '<div class="dashboard-progress-empty">Пока нет активности за период.</div>';
  }
  return `
    <div class="dashboard-progress-bar" aria-label="Активность за период">
      ${active.map((item) => `
        <div class="dashboard-progress-segment ${SEGMENT_CLASSES[item.key] || ''}" style="width:${item.percent}%;" title="${escapeHtml(item.label)}: ${item.value}"></div>
      `).join('')}
    </div>
    <div class="dashboard-progress-legend">
      ${active.map((item) => `
        <span class="dashboard-progress-chip">
          <span class="dashboard-progress-chip-dot ${SEGMENT_CLASSES[item.key] || ''}"></span>
          ${escapeHtml(item.label)}
        </span>
      `).join('')}
    </div>
  `;
}

const PERIOD_METRIC_ORDER = ['diaries', 'successes', 'signals', 'newLinks', 'razbor', 'confirmations'];

function renderPeriodMetrics(metrics = {}) {
  return `
    <div class="dashboard-period-metrics">
      ${PERIOD_METRIC_ORDER.map((key) => metrics[key]).filter(Boolean).map((item) => `
        <article class="dashboard-period-metric ${item.value > 0 ? '' : 'is-empty'}">
          <span class="dashboard-period-metric-label">${escapeHtml(item.label)}</span>
          <strong class="dashboard-period-metric-value">${item.value}</strong>
        </article>
      `).join('')}
    </div>
  `;
}

export function formatPeriodSummary(viewModel) {
  return `${viewModel.period.days} ${pluralize(viewModel.period.days, 'день', 'дня', 'дней')} активности`;
}

export function renderPeriodCard(viewModel, formatDiaryPeriodHuman) {
  const summary = formatPeriodSummary(viewModel);

  return `
    <div class="dashboard-period-card-body">
      <div class="space-y-2">
        <p class="text-xs uppercase tracking-[0.18em] text-primary font-bold">С последней консультации</p>
        <h3 class="dashboard-period-summary">${escapeHtml(summary)}</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">${escapeHtml(formatDiaryPeriodHuman(viewModel.period.dateFrom, viewModel.period.dateTo))}</p>
        ${viewModel.period.note ? `<p class="text-xs text-amber-600 dark:text-amber-300">${escapeHtml(viewModel.period.note)}</p>` : ''}
      </div>
      ${renderProgressBar(viewModel.progressSegments)}
      ${renderPeriodMetrics(viewModel.metrics)}
    </div>
  `;
}

function renderRecentEvents(viewModel) {
  if (!viewModel.recentEvents.length) {
    setHtml('#dashboard-changes', '<div class="diary-empty">За период пока нет событий.</div>');
    return;
  }
  setHtml('#dashboard-changes', viewModel.recentEvents.map((item) => `
    <article class="dashboard-event">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.text || 'Без текста')}</p>
      </div>
      <span>${escapeHtml(item.date)}</span>
    </article>
  `).join(''));
}

function renderDailyContext(viewModel) {
  setHtml('#dashboard-daily-context', [
    renderField('Вопрос утром', viewModel.dailyContext.morningQuestion),
    renderField('Вопрос вечером', viewModel.dailyContext.eveningQuestion),
    renderField('Аффирмация дня', viewModel.dailyContext.affirmation),
    renderField('Цитата дня', viewModel.dailyContext.quote),
  ].join(''));
}

function setDashboardLoading(visible) {
  const el = $('#dashboard-loading');
  if (el) el.style.display = visible ? 'flex' : 'none';
}

function setSummaryAction(viewModel) {
  const btn = $('#btn-dashboard-summary');
  if (!btn) return;
  btn.disabled = !viewModel.actions.openSummary.enabled;
}

export function createDashboardController({
  api,
  formatDiaryPeriodHuman,
  activateTab,
  setStatus,
  smoothScrollToElement,
}) {
  let dashboardLoaded = false;
  let currentViewModel = null;

  function renderDashboard(viewModel) {
    currentViewModel = viewModel;
    setText('#dashboard-period-note', viewModel.period.note || `Период: ${formatDiaryPeriodHuman(viewModel.period.dateFrom, viewModel.period.dateTo)}`);
    renderDashboardErrors(viewModel.errors);
    setHtml('#dashboard-focus-card', renderFocusCard(viewModel));
    setHtml('#dashboard-period-card', renderPeriodCard(viewModel, formatDiaryPeriodHuman));
    renderRecentEvents(viewModel);
    renderDailyContext(viewModel);
    setSummaryAction(viewModel);
  }

  async function loadDashboardViewModel() {
    const todayYmd = getTodayYmd();
    const [stateResult, consultationsResult] = await Promise.allSettled([
      api('state-get'),
      api('summarize-status'),
    ]);
    const statePayload = resultValue(stateResult, { data: {} });
    const consultationsPayload = resultValue(consultationsResult, { items: [] });
    const consultations = consultationsPayload.items || [];
    const period = deriveDashboardPeriod(consultations, todayYmd);
    const query = new URLSearchParams({
      date_from: period.dateFrom,
      date_to: period.dateTo,
      limit: '200',
    });

    const [
      diariesResult,
      linksResult,
      suggestionsResult,
      linksReportResult,
      razborResult,
      retroResult,
    ] = await Promise.allSettled([
      api(`diaries?${query.toString()}`),
      api('links'),
      api('link-suggestions?status=pending&limit=30'),
      api('links-progress-report?period=8w'),
      api('razbor-history'),
      api('retro-status'),
    ]);

    const errors = mapErrors({
      state: stateResult,
      consultations: consultationsResult,
      diaries: diariesResult,
      links: linksResult,
      suggestions: suggestionsResult,
      linksReport: linksReportResult,
      razborHistory: razborResult,
      retroStatus: retroResult,
    });

    return buildDashboardViewModel({
      state: statePayload.data || {},
      consultations,
      diaries: resultValue(diariesResult, { items: [] }).items || [],
      links: resultValue(linksResult, { active_items: [], inactive_items: [] }),
      suggestions: resultValue(suggestionsResult, { items: [] }).items || [],
      linksReport: resultValue(linksReportResult, {}),
      razborHistory: resultValue(razborResult, { items: [] }).items || [],
      retroStatus: resultValue(retroResult, { items: [] }),
      errors,
    }, { todayYmd });
  }

  async function openDashboardTab(force = false) {
    if (dashboardLoaded && !force) return;
    setDashboardLoading(true);
    try {
      const viewModel = await loadDashboardViewModel();
      renderDashboard(viewModel);
      dashboardLoaded = true;
      setStatus('Дэшборд обновлён', 'saved');
    } catch (err) {
      console.error('dashboard load error', err);
      setHtml('#dashboard-errors', '<div class="inline-error" style="display:block">Не удалось собрать дэшборд. Попробуй обновить экран.</div>');
      setStatus(err.data?.error || 'Не удалось собрать дэшборд', 'error');
    } finally {
      setDashboardLoading(false);
    }
  }

  function focusElement(selector) {
    requestAnimationFrame(() => {
      const el = $(selector);
      if (!el) return;
      smoothScrollToElement(el, 'center');
      el.focus?.();
    });
  }

  function openPeriodTab(target) {
    if (!currentViewModel?.period) return;
    activateTab(target, { period: currentViewModel.period });
  }

  function handleDashboardAction(action) {
    if (action === 'diaries') {
      openPeriodTab('diaries');
      return;
    }
    if (action === 'links') {
      activateTab('links');
      return;
    }
    if (action === 'signals') {
      activateTab('links');
      focusElement('#btn-link-process-signals');
      return;
    }
    if (action === 'retro') {
      openPeriodTab('retro');
      focusElement('#btn-retro-start');
      return;
    }
    if (action === 'summary' && currentViewModel?.actions?.openSummary?.enabled) {
      activateTab('consultations', { consultationId: currentViewModel.actions.openSummary.consultationId });
    }
  }

  function bindDashboardEvents() {
    $('#btn-dashboard-refresh')?.addEventListener('click', () => openDashboardTab(true));
    $('#tab-dashboard')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-dashboard-action]');
      if (!button) return;
      handleDashboardAction(button.dataset.dashboardAction);
    });
  }

  return {
    bindDashboardEvents,
    openDashboardTab,
  };
}

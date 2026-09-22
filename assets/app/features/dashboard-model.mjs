const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateOnly(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function getTodayYmd(now = new Date()) {
  return [now.getFullYear(), pad2(now.getMonth() + 1), pad2(now.getDate())].join('-');
}

function addDaysYmd(ymd, delta) {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function daysInclusive(dateFrom, dateTo) {
  const from = Date.parse(`${dateFrom}T00:00:00.000Z`);
  const to = Date.parse(`${dateTo}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
  return Math.floor((to - from) / DAY_MS) + 1;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function allLinks(links) {
  return [
    ...asArray(links?.active_items),
    ...asArray(links?.inactive_items),
  ];
}

function truncateText(value, limit = 180) {
  const text = String(value || '').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function firstText(...values) {
  return values.map((value) => String(value || '').trim()).find(Boolean) || '';
}

function createMetric(label, value, hint = '') {
  return {
    label,
    value: Math.max(0, Math.floor(Number(value || 0))),
    hint,
  };
}

function countDiarySource(items, source) {
  return asArray(items).filter((item) => item.source === source).length;
}

function findFocusLink(state = {}, links = {}) {
  const linkItems = allLinks(links);
  const publishedId = String(state.published_link_id || '').trim();
  const focusText = [state.link_main, state.gpt_situation]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('\n');
  const normalizedFocusText = focusText.toLowerCase();

  const byId = publishedId
    ? linkItems.find((item) => String(item.id) === publishedId)
    : null;
  const byText = !byId && focusText
    ? linkItems.find((item) => [item.new_belief, item.stimulus, item.new_actions]
      .map((field) => String(field || '').trim())
      .filter(Boolean)
      .some((field) => normalizedFocusText.includes(field.toLowerCase())))
    : null;
  const link = byId || byText || null;

  if (!link && !focusText) {
    return {
      id: '',
      title: 'Связка в фокусе не выбрана',
      text: '',
      stimulus: '',
      reaction: '',
      oldBelief: '',
      newBelief: '',
      newActions: '',
      signals: 0,
      confirmations: 0,
      isEmpty: true,
    };
  }

  return {
    id: String(link?.id || publishedId || '').trim(),
    title: firstText(link?.new_belief, link?.stimulus, focusText, 'Связка в фокусе'),
    text: focusText,
    stimulus: String(link?.stimulus || '').trim(),
    reaction: String(link?.reaction || '').trim(),
    oldBelief: String(link?.old_belief || '').trim(),
    newBelief: String(link?.new_belief || '').trim(),
    newActions: String(link?.new_actions || '').trim(),
    signals: Math.max(0, Math.floor(Number(state.published_link_progress || 0))),
    confirmations: 0,
    isEmpty: false,
  };
}

function getConfirmedProgress(focus, linksReport = {}) {
  const active = linksReport?.active_link || {};
  if (focus.id && String(active.id || '') === String(focus.id || '')) {
    return Math.max(0, Math.floor(Number(active.confirmed_progress || 0)));
  }
  const reportItem = asArray(linksReport?.links).find((item) => String(item.id) === String(focus.id || ''));
  return Math.max(0, Math.floor(Number(reportItem?.progress_events || 0)));
}

function buildRecentEvents({ period, diaries, suggestions, links, razborHistory, retroStatus, latestConsultation }) {
  const events = [];

  for (const item of asArray(diaries)) {
    if (!isWithinPeriod(item.local_date || item.created_at, period)) continue;
    const type = item.source === 'sendpulse_success' ? 'success' : 'diary';
    events.push({
      type,
      date: toDateOnly(item.local_date || item.created_at),
      title: type === 'success' ? 'Успех' : 'Дневник',
      text: truncateText(item.text || ''),
    });
  }

  for (const item of asArray(suggestions)) {
    if (!isWithinPeriod(item.created_at, period)) continue;
    events.push({
      type: 'signal',
      date: toDateOnly(item.created_at),
      title: 'Сигнал на разбор',
      text: truncateText(item.signal_text || item.rationale || ''),
    });
  }

  for (const item of allLinks(links)) {
    if (!isWithinPeriod(item.created_at, period)) continue;
    events.push({
      type: 'link',
      date: toDateOnly(item.created_at),
      title: 'Новая связка',
      text: truncateText(firstText(item.new_belief, item.stimulus)),
    });
  }

  for (const item of asArray(razborHistory)) {
    if (!isWithinPeriod(item.occurred_at || item.created_at, period)) continue;
    events.push({
      type: 'razbor',
      date: toDateOnly(item.occurred_at || item.created_at),
      title: 'Разбор',
      text: truncateText(item.summary_text || ''),
    });
  }

  const latestRetro = asArray(retroStatus?.items)[0] || null;
  if (latestRetro?.updated_at || latestRetro?.created_at) {
    events.push({
      type: 'retro',
      date: toDateOnly(latestRetro.updated_at || latestRetro.created_at),
      title: 'Последнее ретро',
      text: latestRetro.status === 'completed'
        ? 'Ретро готово в истории.'
        : `Статус: ${latestRetro.status || 'обработка'}`,
    });
  }

  if (latestConsultation?.created_at) {
    events.push({
      type: 'summary',
      date: toDateOnly(latestConsultation.created_at),
      title: 'Последнее summary',
      text: 'Доступно во вкладке Summary.',
    });
  }

  return events
    .filter((item) => item.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
}

export function deriveDashboardPeriod(consultations = [], todayYmd = getTodayYmd()) {
  const completed = consultations
    .filter((item) => item?.status === 'completed' && item?.created_at)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;

  if (completed) {
    const dateFrom = toDateOnly(completed.created_at);
    return {
      dateFrom,
      dateTo: todayYmd,
      days: daysInclusive(dateFrom, todayYmd),
      source: 'consultation',
      note: '',
      lastConsultation: completed,
    };
  }

  const dateFrom = addDaysYmd(todayYmd, -29);
  return {
    dateFrom,
    dateTo: todayYmd,
    days: 30,
    source: 'fallback_30d',
    note: 'Консультаций пока нет, показаны последние 30 дней.',
    lastConsultation: null,
  };
}

export function isWithinPeriod(value, period) {
  const date = toDateOnly(value);
  if (!date || !period?.dateFrom || !period?.dateTo) return false;
  return date >= period.dateFrom && date <= period.dateTo;
}

export function buildProgressSegments(metrics) {
  const segments = [
    { key: 'diaries', label: 'Дневники', value: metrics.diaries.value },
    { key: 'successes', label: 'Успехи', value: metrics.successes.value },
    { key: 'signals', label: 'Сигналы', value: metrics.signals.value },
    { key: 'newLinks', label: 'Связки', value: metrics.newLinks.value },
    { key: 'razbor', label: 'Разборы', value: metrics.razbor.value },
    { key: 'confirmations', label: 'Подтв.', value: metrics.confirmations.value },
  ];
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return segments.map((item) => ({
      ...item,
      percent: 0,
    }));
  }

  const nonzeroIndexes = segments
    .map((item, index) => (item.value > 0 ? index : -1))
    .filter((index) => index >= 0);
  const minVisible = nonzeroIndexes.length > 0 && nonzeroIndexes.length * 4 <= 100 ? 4 : 1;
  const baseTotal = minVisible * nonzeroIndexes.length;
  const remaining = Math.max(0, 100 - baseTotal);
  const valueTotal = nonzeroIndexes.reduce((sum, index) => sum + segments[index].value, 0);

  const withBase = segments.map((item) => ({
    ...item,
    percent: item.value > 0 ? minVisible : 0,
  }));

  if (remaining === 0 || valueTotal <= 0) {
    return withBase;
  }

  const extras = nonzeroIndexes.map((index) => {
    const exact = (remaining * segments[index].value) / valueTotal;
    const extra = Math.floor(exact);
    return {
      index,
      extra,
      fraction: exact - extra,
    };
  });

  let leftover = remaining - extras.reduce((sum, item) => sum + item.extra, 0);

  extras
    .sort((a, b) => b.fraction - a.fraction || segments[b.index].value - segments[a.index].value)
    .forEach((item) => {
      if (leftover <= 0) return;
      item.extra += 1;
      leftover -= 1;
    });

  for (const item of extras) {
    withBase[item.index].percent += item.extra;
  }

  return withBase;
}

export function buildDashboardViewModel(sources = {}, options = {}) {
  const todayYmd = options.todayYmd || getTodayYmd();
  const consultations = asArray(sources.consultations);
  const period = deriveDashboardPeriod(consultations, todayYmd);
  const latestConsultation = period.lastConsultation || consultations.find((item) => item.status === 'completed') || null;
  const diaries = asArray(sources.diaries).filter((item) => isWithinPeriod(item.local_date || item.created_at, period));
  const suggestions = asArray(sources.suggestions).filter((item) => isWithinPeriod(item.created_at, period));
  const links = sources.links || {};
  const newLinks = allLinks(links).filter((item) => isWithinPeriod(item.created_at, period));
  const razborHistory = asArray(sources.razborHistory).filter((item) => isWithinPeriod(item.occurred_at || item.created_at, period));
  const focus = findFocusLink(sources.state || {}, links);
  focus.confirmations = getConfirmedProgress(focus, sources.linksReport || {});

  const metrics = {
    diaries: createMetric('Дневники', diaries.length, 'записи за период'),
    successes: createMetric('Успехи', countDiarySource(diaries, 'sendpulse_success'), 'raw-успехи'),
    signals: createMetric('Сигналы', suggestions.length, 'ожидают разбора'),
    newLinks: createMetric('Новые связки', newLinks.length, 'созданы за период'),
    razbor: createMetric('Разборы', razborHistory.length, 'завершены за период'),
    confirmations: createMetric('Подтверждения', focus.confirmations, 'по связке в фокусе'),
  };

  return {
    clientName: String(sources.state?.name || '').trim(),
    period,
    focus,
    dailyContext: {
      morningQuestion: String(sources.state?.q_morning || '').trim(),
      eveningQuestion: String(sources.state?.q_evening || '').trim(),
      affirmation: String(sources.state?.affirm || '').trim(),
      quote: firstText(sources.state?.video, sources.state?.q1),
    },
    metrics,
    progressSegments: buildProgressSegments(metrics),
    recentEvents: buildRecentEvents({
      period,
      diaries,
      suggestions,
      links,
      razborHistory,
      retroStatus: sources.retroStatus,
      latestConsultation,
    }),
    actions: {
      openSummary: {
        enabled: Boolean(latestConsultation?.id),
        consultationId: latestConsultation?.id || '',
      },
    },
    errors: sources.errors || {},
  };
}

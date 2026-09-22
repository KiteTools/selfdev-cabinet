import { parsePeriodInput } from './diaries.js';
import { formatLinkText } from './summarizer.js';

export const UNDERSTANDING_DOC_TYPES = {
  false_beliefs: {
    id: 'false_beliefs',
    title: 'ложные.md',
    heading: 'Ложные понимания',
  },
  new_understandings: {
    id: 'new_understandings',
    title: 'новые.md',
    heading: 'Новые понимания',
  },
};

export const UNDERSTANDING_DOC_TYPE_IDS = Object.keys(UNDERSTANDING_DOC_TYPES);
export const LINK_FIELDS = ['stimulus', 'reaction', 'old_belief', 'new_belief', 'new_actions'];
export const LINK_ACTIVE_LIMIT = 10;
export const LINK_SIGNAL_SOURCE_TYPES = new Set(['diary_entry', 'crm_evening', 'crm_reaction', 'manual']);
export const CRM_ACTIVITY_TYPES = new Set(['evening_plus', 'task_done', 'other']);
export const RETRO_PROMPT_VERSION = 'weekly-retro-v2';
export const RETRO_INPUT_LIMITS = {
  diaries: { maxItems: 40, maxChars: 70000 },
  razborSessions: { maxItems: 30, maxChars: 30000 },
  newLinks: { maxItems: 20, maxChars: 24000 },
  progressEvents: { maxItems: 40, maxChars: 26000 },
  crmEvents: { maxItems: 60, maxChars: 18000 },
};
export const LINK_MATCH_INPUT_LIMITS = {
  signalChars: 16000,
  linkFieldChars: 1200,
};

export const LINK_MATCH_PROMPT = [
  'Ты анализируешь сигнал пользователя и список его активных связок.',
  'Верни строго один JSON-объект без markdown и комментариев.',
  'Доступные suggestion_type:',
  '- progress_match: сигнал хорошо ложится на одну из активных связок и похож на прогресс.',
  '- new_link: сигнал указывает на новую потенциальную связку.',
  '- ignore: сигнал не подходит ни для прогресса, ни для новой связки.',
  'Формат JSON:',
  '{"suggestion_type":"progress_match|new_link|ignore","suggested_link_id":"uuid-or-null","confidence":0.0,"rationale":"...","extracted_payload":{"note":"...","candidate_link":{"stimulus":"","reaction":"","old_belief":"","new_belief":"","new_actions":""}}}',
  'Если suggestion_type = progress_match, suggested_link_id должен быть одним из переданных активных link ids.',
  'Если suggestion_type = new_link, заполни candidate_link максимально конкретно, но без вымысла.',
  'Если данных мало, используй ignore.',
].join('\n');

export const WEEKLY_RETRO_PROMPT = [
  'Ты делаешь недельное ретро клиента по данным за выбранный период.',
  'Во входе могут быть: дневники, завершённые разборы, новые связки, подтвержденный прогресс по связкам, реакции CRM и выполнение задач.',
  'Главный приоритет: практика и применение, а не пересказ смысловых summary.',
  'Опирайся в первую очередь на дневники, success-записи, события вечернего бота / CRM, выполнение задач и progress events по связкам.',
  'Разборы используй как supporting context только там, где они подтверждаются действиями и фактами периода.',
  'Не реконструируй и не анализируй отсутствующие консультационные summary.',
  'Пиши только по-русски.',
  'Верни итог в markdown/plaintext, без JSON.',
  'Используй разделы:',
  '1) Главные успехи периода',
  '2) Где новое уже применилось на практике',
  '3) Повторяющиеся сложности',
  '4) Разборы и инсайты, которые подтвердились в действиях',
  '5) Прогресс по связкам',
  '6) Новые связки и новые понимания из практики',
  '7) Вечерний бот, ежедневные задачи и сигналы устойчивости',
  '8) Главные выводы периода',
  '9) Фокус на следующий период',
  'В каждом разделе используй конкретные буллеты и наблюдаемые факты.',
  'Не добавляй вымышленные факты.',
].join('\n');

export function getQueryParam(event, key) {
  if (event.queryStringParameters?.[key] !== undefined) {
    return event.queryStringParameters[key];
  }
  const params = new URLSearchParams(event.rawQuery || '');
  return params.get(key);
}

export function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

export function isValidEmail(value) {
  return /.+@.+\..+/.test(String(value || ''));
}

export function clampText(value, maxLength = 10000) {
  const str = String(value ?? '').trim();
  if (!str) return '';
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

export function parseJsonFromText(text) {
  const src = String(text || '').trim();
  if (!src) {
    throw new Error('Empty JSON text');
  }

  try {
    return JSON.parse(src);
  } catch {}

  const firstBrace = src.indexOf('{');
  const lastBrace = src.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(src.slice(firstBrace, lastBrace + 1));
  }

  throw new Error('Invalid JSON text');
}

export function normalizeDocType(value) {
  const key = String(value || '').trim();
  return UNDERSTANDING_DOC_TYPES[key] ? key : '';
}

function renderUnderstandingMarkdown(docType, items) {
  const doc = UNDERSTANDING_DOC_TYPES[docType];
  const safeItems = Array.isArray(items)
    ? items.map((item) => clampText(item, 4000)).filter(Boolean)
    : [];

  const lines = [`# ${doc.heading}`, ''];
  if (!safeItems.length) {
    lines.push('- —');
    return lines.join('\n');
  }
  for (const item of safeItems) {
    lines.push(`- ${item}`);
  }
  return lines.join('\n').trim();
}

export function buildUnderstandingDocs(summaryInput, consultationId = null) {
  const summary = normalizeSummary(summaryInput);
  return [
    {
      doc_type: 'false_beliefs',
      title: UNDERSTANDING_DOC_TYPES.false_beliefs.title,
      content_md: renderUnderstandingMarkdown('false_beliefs', summary.false_beliefs),
      source_consultation_id: consultationId,
    },
    {
      doc_type: 'new_understandings',
      title: UNDERSTANDING_DOC_TYPES.new_understandings.title,
      content_md: renderUnderstandingMarkdown('new_understandings', summary.new_understandings),
      source_consultation_id: consultationId,
    },
  ];
}

export function mapUnderstandingDocRow(row) {
  return {
    id: row.id,
    doc_type: row.doc_type,
    status: row.status,
    title: row.title,
    content_md: row.content_md,
    source_consultation_id: row.source_consultation_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseSlotNo(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return null;
  const slot = Number(rawValue);
  if (!Number.isInteger(slot) || slot < 1 || slot > LINK_ACTIVE_LIMIT) {
    return Number.NaN;
  }
  return slot;
}

export function normalizeLinkPayload(payload, { allowPartial = false } = {}) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const result = {};
  const errors = {};

  for (const field of LINK_FIELDS) {
    const hasField = Object.prototype.hasOwnProperty.call(input, field);
    if (!allowPartial || hasField) {
      const value = clampText(input[field], 4000);
      if (!value) {
        errors[field] = 'Поле обязательно';
      } else {
        result[field] = value;
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    const status = String(input.status || '').trim();
    if (status !== 'active' && status !== 'inactive') {
      errors.status = 'Статус должен быть active или inactive';
    } else {
      result.status = status;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'slot_no')) {
    const slotNo = parseSlotNo(input.slot_no);
    if (Number.isNaN(slotNo)) {
      errors.slot_no = `slot_no должен быть от 1 до ${LINK_ACTIVE_LIMIT}`;
    } else {
      result.slot_no = slotNo;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'source_consultation_id')) {
    const sourceConsultationId = String(input.source_consultation_id || '').trim();
    if (sourceConsultationId && !isValidUuid(sourceConsultationId)) {
      errors.source_consultation_id = 'Некорректный consultation id';
    } else {
      result.source_consultation_id = sourceConsultationId || null;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: result,
  };
}

export function mapLinkRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    status: row.status,
    slot_no: row.slot_no,
    stimulus: row.stimulus,
    reaction: row.reaction,
    old_belief: row.old_belief,
    new_belief: row.new_belief,
    new_actions: row.new_actions,
    source_consultation_id: row.source_consultation_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function getFirstAvailableSlot(activeItems) {
  const used = new Set(
    (Array.isArray(activeItems) ? activeItems : [])
      .map((item) => Number(item.slot_no))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= LINK_ACTIVE_LIMIT)
  );

  for (let slot = 1; slot <= LINK_ACTIVE_LIMIT; slot++) {
    if (!used.has(slot)) return slot;
  }
  return null;
}

export function serializeLinkForVariable(link) {
  return clampText(formatLinkText({
    stimulus: clampText(link?.stimulus, 980),
    reaction: clampText(link?.reaction, 980),
    old_belief: clampText(link?.old_belief, 980),
    new_belief: clampText(link?.new_belief, 980),
    new_actions: clampText(link?.new_actions, 980),
  }), 1000);
}

export function buildLinkMatchInput(signalInput, activeLinks) {
  const safeSignal = clampText(signalInput?.text, LINK_MATCH_INPUT_LIMITS.signalChars);
  const links = Array.isArray(activeLinks) ? activeLinks : [];
  const activeLinksBlock = links.length
    ? links.map((link) => [
      `link_id: ${link.id}`,
      `slot_no: ${link.slot_no ?? '—'}`,
      `stimulus: ${clampText(link.stimulus, LINK_MATCH_INPUT_LIMITS.linkFieldChars)}`,
      `reaction: ${clampText(link.reaction, LINK_MATCH_INPUT_LIMITS.linkFieldChars)}`,
      `old_belief: ${clampText(link.old_belief, LINK_MATCH_INPUT_LIMITS.linkFieldChars)}`,
      `new_belief: ${clampText(link.new_belief, LINK_MATCH_INPUT_LIMITS.linkFieldChars)}`,
      `new_actions: ${clampText(link.new_actions, LINK_MATCH_INPUT_LIMITS.linkFieldChars)}`,
    ].join('\n')).join('\n\n---\n\n')
    : 'Нет активных связок';

  return [
    `source_type: ${signalInput?.source_type || 'unknown'}`,
    `source_ref_id: ${signalInput?.source_ref_id || '—'}`,
    'SIGNAL TEXT:',
    safeSignal || '—',
    '',
    'ACTIVE LINKS:',
    activeLinksBlock,
  ].join('\n');
}

function normalizeCandidateLink(candidate) {
  const result = {};
  for (const field of LINK_FIELDS) {
    result[field] = clampText(candidate?.[field], 4000);
  }
  return result;
}

export function normalizeLinkSuggestion(rawSuggestion, activeLinks = []) {
  const src = rawSuggestion && typeof rawSuggestion === 'object' ? rawSuggestion : {};
  const activeIds = new Set((Array.isArray(activeLinks) ? activeLinks : []).map((item) => String(item.id)));
  const suggestionType = ['progress_match', 'new_link', 'ignore'].includes(src.suggestion_type)
    ? src.suggestion_type
    : 'ignore';
  const suggestedLinkId = activeIds.has(String(src.suggested_link_id || ''))
    ? String(src.suggested_link_id)
    : null;
  const confidenceRaw = Number(src.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : 0;
  const candidateLink = normalizeCandidateLink(src.extracted_payload?.candidate_link);

  return {
    suggestion_type: suggestionType,
    suggested_link_id: suggestionType === 'progress_match' ? suggestedLinkId : null,
    confidence,
    rationale: clampText(src.rationale, 4000),
    extracted_payload: {
      note: clampText(src.extracted_payload?.note, 4000),
      candidate_link: candidateLink,
    },
  };
}

function formatLinkBlock(row, index) {
  return [
    `Связка ${index + 1}`,
    `created_at: ${row.created_at}`,
    `status: ${row.status}`,
    `slot_no: ${row.slot_no ?? '—'}`,
    `stimulus: ${row.stimulus}`,
    `reaction: ${row.reaction}`,
    `old_belief: ${row.old_belief}`,
    `new_belief: ${row.new_belief}`,
    `new_actions: ${row.new_actions}`,
  ].join('\n');
}

function formatProgressEventBlock(row, index) {
  return [
    `Progress event ${index + 1}`,
    `created_at: ${row.created_at}`,
    `source_type: ${row.source_type}`,
    `source_ref_id: ${row.source_ref_id || '—'}`,
    `link: ${serializeLinkForVariable(row)}`,
    `note: ${clampText(row.note, 2000) || '—'}`,
  ].join('\n');
}

function formatCrmEventBlock(row, index) {
  return [
    `CRM event ${index + 1}`,
    `occurred_at: ${row.occurred_at}`,
    `event_type: ${row.event_type}`,
    `value_text: ${clampText(row.value_text, 2000) || '—'}`,
    `value_number: ${row.value_number ?? '—'}`,
    `payload: ${clampText(JSON.stringify(row.payload || {}), 1200)}`,
  ].join('\n');
}

function formatDiaryBlock(row, index) {
  const source = String(row.source || '').trim();
  return [
    `Дневник ${index + 1}`,
    `local_date: ${row.local_date}`,
    `created_at: ${row.created_at}`,
    `source: ${source || '—'}`,
    `entry_kind: ${source === 'sendpulse_success' ? 'success' : 'diary'}`,
    'text:',
    clampText(row.text, 6000) || '—',
  ].join('\n');
}

function formatRazborSessionBlock(row, index) {
  return [
    `Разбор ${index + 1}`,
    `occurred_at: ${row.occurred_at || row.created_at}`,
    `status: ${row.status || '—'}`,
    `source: ${row.source || '—'}`,
    'summary_text:',
    clampText(row.summary_text, 4000) || '—',
  ].join('\n');
}

function buildRecentSection(rows, { maxItems, maxChars }, formatter) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const safeMaxItems = Math.max(1, Number(maxItems) || 1);
  const safeMaxChars = Math.max(2000, Number(maxChars) || 2000);
  const selected = [];
  let usedChars = 0;

  for (let index = sourceRows.length - 1; index >= 0; index--) {
    if (selected.length >= safeMaxItems) break;

    const block = String(formatter(sourceRows[index], selected.length) || '').trim();
    if (!block) continue;

    const separatorLength = selected.length ? '\n\n---\n\n'.length : 0;
    const nextLength = usedChars + separatorLength + block.length;
    if (nextLength > safeMaxChars) {
      if (!selected.length) {
        selected.push(clampText(block, safeMaxChars));
        usedChars = selected[0].length;
      }
      break;
    }

    selected.push(block);
    usedChars = nextLength;
  }

  return {
    content: selected.length ? selected.join('\n\n---\n\n') : '—',
    meta: {
      total: sourceRows.length,
      included: selected.length,
      omitted: Math.max(0, sourceRows.length - selected.length),
      used_chars: usedChars,
      max_chars: safeMaxChars,
      max_items: safeMaxItems,
      truncated: selected.length < sourceRows.length,
    },
  };
}

export function buildRetroInput({
  dateFrom,
  dateTo,
  diaries = [],
  razborSessions = [],
  newLinks = [],
  progressEvents = [],
  crmEvents = [],
}) {
  const taskDone = crmEvents.filter((item) => item.event_type === 'task_done');
  const pluses = crmEvents.filter((item) => item.event_type === 'evening_plus');
  const diarySection = buildRecentSection(diaries, RETRO_INPUT_LIMITS.diaries, formatDiaryBlock);
  const razborSection = buildRecentSection(
    razborSessions,
    RETRO_INPUT_LIMITS.razborSessions,
    formatRazborSessionBlock
  );
  const newLinksSection = buildRecentSection(newLinks, RETRO_INPUT_LIMITS.newLinks, formatLinkBlock);
  const progressSection = buildRecentSection(
    progressEvents,
    RETRO_INPUT_LIMITS.progressEvents,
    formatProgressEventBlock
  );
  const crmSection = buildRecentSection(crmEvents, RETRO_INPUT_LIMITS.crmEvents, formatCrmEventBlock);
  const inputSummary = {
    period: {
      date_from: dateFrom,
      date_to: dateTo,
    },
    counts: {
      diaries: diaries.length,
      razbor_sessions: razborSessions.length,
      new_links: newLinks.length,
      progress_events: progressEvents.length,
      crm_events: crmEvents.length,
      pluses: pluses.length,
      task_done: taskDone.length,
    },
    truncation: {
      strategy: 'latest-first',
      diaries: diarySection.meta,
      razbor_sessions: razborSection.meta,
      new_links: newLinksSection.meta,
      progress_events: progressSection.meta,
      crm_events: crmSection.meta,
    },
  };

  const blocks = [
    `Период: ${dateFrom} .. ${dateTo}`,
    '',
    'COUNT SUMMARY:',
    JSON.stringify(inputSummary.counts, null, 2),
    '',
    'TRUNCATION SUMMARY:',
    JSON.stringify(inputSummary.truncation, null, 2),
    '',
    'ДНЕВНИКИ:',
    diarySection.content,
    '',
    'РАЗБОРЫ:',
    razborSection.content,
    '',
    'НОВЫЕ СВЯЗКИ:',
    newLinksSection.content,
    '',
    'ПОДТВЕРЖДЕННЫЙ ПРОГРЕСС ПО СВЯЗКАМ:',
    progressSection.content,
    '',
    'CRM / SENDPULSE СОБЫТИЯ:',
    crmSection.content,
  ];

  return {
    input: blocks.join('\n'),
    input_summary: inputSummary,
  };
}

export function resolveRetroPeriod(dateFrom, dateTo) {
  return parsePeriodInput(dateFrom, dateTo, 90);
}

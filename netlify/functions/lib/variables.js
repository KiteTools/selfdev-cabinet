/**
 * Маппинг переменных Личного кабинета ↔ SendPulse.
 * Ключ — внутреннее имя в Личном кабинете, sp — имя переменной в SendPulse.
 */
export const VARIABLE_MAP = {
  // === Быстро ===
  cycle_day: { sp: '№ дня',               label: 'День цикла', type: 'int', min: 1, max: 10, group: 'quick', manualOnly: true },
  tz:        { sp: null, dbOnly: true,     label: 'Таймзона',   type: 'timezone', required: true, group: 'quick' },
  t1:        { sp: 'time_vopros_utro',     label: 'Время утро',  type: 'time', required: true, group: 'quick' },
  t2:        { sp: 'time_vopros_vecher',   label: 'Время вечер', type: 'time', required: true, group: 'quick' },

  // === Профиль ===
  name: { sp: 'name', label: 'Имя', type: 'string', maxLength: 20, noEmoji: true, group: 'profile' },

  // === Аффирмации ===
  aff1:  { sp: 'affirm_cont_1',  label: 'Аффирмация 1',  type: 'string', maxLength: 1000, group: 'affirmations' },
  aff2:  { sp: 'affirm_cont_2',  label: 'Аффирмация 2',  type: 'string', maxLength: 1000, group: 'affirmations' },
  aff3:  { sp: 'affirm_cont_3',  label: 'Аффирмация 3',  type: 'string', maxLength: 1000, group: 'affirmations' },
  aff4:  { sp: 'affirm_cont_4',  label: 'Аффирмация 4',  type: 'string', maxLength: 1000, group: 'affirmations' },
  aff5:  { sp: 'affirm_cont_5',  label: 'Аффирмация 5',  type: 'string', maxLength: 1000, group: 'affirmations' },
  aff6:  { sp: 'affirm_cont_6',  label: 'Аффирмация 6',  type: 'string', maxLength: 1000, group: 'affirmations' },
  aff7:  { sp: 'affirm_cont_7',  label: 'Аффирмация 7',  type: 'string', maxLength: 1000, group: 'affirmations' },
  aff8:  { sp: 'affirm_cont_8',  label: 'Аффирмация 8',  type: 'string', maxLength: 1000, group: 'affirmations' },
  aff9:  { sp: 'affirm_cont_9',  label: 'Аффирмация 9',  type: 'string', maxLength: 1000, group: 'affirmations' },
  aff10: { sp: 'affirm_cont_10', label: 'Аффирмация 10', type: 'string', maxLength: 1000, group: 'affirmations' },

  // === Цитаты ===
  quote_pack: { sp: null, dbOnly: true, label: 'Стартовый набор', type: 'enum', values: ['base', 'pro'], group: 'quotes' },
  q1:  { sp: 'video_cont_1',  label: 'Цитата 1',  type: 'string', maxLength: 1000, group: 'quotes' },
  q2:  { sp: 'video_cont_2',  label: 'Цитата 2',  type: 'string', maxLength: 1000, group: 'quotes' },
  q3:  { sp: 'video_cont_3',  label: 'Цитата 3',  type: 'string', maxLength: 1000, group: 'quotes' },
  q4:  { sp: 'video_cont_4',  label: 'Цитата 4',  type: 'string', maxLength: 1000, group: 'quotes' },
  q5:  { sp: 'video_cont_5',  label: 'Цитата 5',  type: 'string', maxLength: 1000, group: 'quotes' },
  q6:  { sp: 'video_cont_6',  label: 'Цитата 6',  type: 'string', maxLength: 1000, group: 'quotes' },
  q7:  { sp: 'video_cont_7',  label: 'Цитата 7',  type: 'string', maxLength: 1000, group: 'quotes' },
  q8:  { sp: 'video_cont_8',  label: 'Цитата 8',  type: 'string', maxLength: 1000, group: 'quotes' },
  q9:  { sp: 'video_cont_9',  label: 'Цитата 9',  type: 'string', maxLength: 1000, group: 'quotes' },
  q10: { sp: 'video_cont_10', label: 'Цитата 10', type: 'string', maxLength: 1000, group: 'quotes' },

  // === Разбор -> SendPulse ===
  razbor_false_01: { sp: 'razbor_false_01', label: 'Ложные понимания SP 01', type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_false_02: { sp: 'razbor_false_02', label: 'Ложные понимания SP 02', type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_false_03: { sp: 'razbor_false_03', label: 'Ложные понимания SP 03', type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_false_04: { sp: 'razbor_false_04', label: 'Ложные понимания SP 04', type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_false_05: { sp: 'razbor_false_05', label: 'Ложные понимания SP 05', type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_false_06: { sp: 'razbor_false_06', label: 'Ложные понимания SP 06', type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_false_07: { sp: 'razbor_false_07', label: 'Ложные понимания SP 07', type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_false_08: { sp: 'razbor_false_08', label: 'Ложные понимания SP 08', type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_false_09: { sp: 'razbor_false_09', label: 'Ложные понимания SP 09', type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_false_10: { sp: 'razbor_false_10', label: 'Ложные понимания SP 10', type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_new_01:   { sp: 'razbor_new_01',   label: 'Новые понимания SP 01',  type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_new_02:   { sp: 'razbor_new_02',   label: 'Новые понимания SP 02',  type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_new_03:   { sp: 'razbor_new_03',   label: 'Новые понимания SP 03',  type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_new_04:   { sp: 'razbor_new_04',   label: 'Новые понимания SP 04',  type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_new_05:   { sp: 'razbor_new_05',   label: 'Новые понимания SP 05',  type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_new_06:   { sp: 'razbor_new_06',   label: 'Новые понимания SP 06',  type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_new_07:   { sp: 'razbor_new_07',   label: 'Новые понимания SP 07',  type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_new_08:   { sp: 'razbor_new_08',   label: 'Новые понимания SP 08',  type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_new_09:   { sp: 'razbor_new_09',   label: 'Новые понимания SP 09',  type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },
  razbor_new_10:   { sp: 'razbor_new_10',   label: 'Новые понимания SP 10',  type: 'string', maxLength: 1000, group: 'razbor_sendpulse' },

  // === Связки ===
  link_main:                { sp: null, dbOnly: true, label: 'Связка в фокусе',              type: 'string', maxLength: 1000, group: 'links' },
  link_add:                 { sp: null, dbOnly: true, label: 'Дополнительная связка',        type: 'string', maxLength: 1000, group: 'links' },
  published_link_id:        { sp: null, dbOnly: true, label: 'ID связки в фокусе',           type: 'uuid', group: 'links' },
  published_link_progress:  { sp: null, dbOnly: true, label: 'Сигналы по связке в фокусе',   type: 'int', min: 0, max: 999999, group: 'links' },

  // === Утро и вечер ===
  q_morning:    { sp: 'vopros_utro',   label: 'Вопросы утром',   type: 'string', maxLength: 1000, group: 'morning_evening' },
  q_evening:    { sp: 'vopros_vecher', label: 'Вопросы вечером', type: 'string', maxLength: 1000, group: 'morning_evening' },
  morning_algo: { sp: 'utro',          label: 'Алгоритм утро',   type: 'string', maxLength: 1000, group: 'morning_evening' },
  evening_algo: { sp: 'vecher',        label: 'Алгоритм вечер',  type: 'string', maxLength: 1000, group: 'morning_evening' },

  // === Инструкции ChatGPT ===
  gpt_standard:    { sp: 'standard',    label: 'Стандарт ответа',      type: 'string', maxLength: 1000, group: 'gpt' },
  gpt_format:      { sp: 'format',      label: 'Формат и ограничения', type: 'string', maxLength: 1000, group: 'gpt' },
  gpt_zapros:      { sp: 'zapros',      label: 'Запрос клиента',       type: 'string', maxLength: 1000, group: 'gpt' },
  gpt_motiv:       { sp: 'motiv',       label: 'Мотивация',            type: 'string', maxLength: 1000, group: 'gpt' },
  gpt_situation:   { sp: 'situation',   label: 'Связка в фокусе',      type: 'string', maxLength: 1000, group: 'gpt' },
  gpt_grabli:      { sp: 'grabli',      label: 'Грабли',               type: 'string', maxLength: 1000, group: 'gpt' },
  gpt_talants:     { sp: 'talants',     label: 'Таланты',              type: 'string', maxLength: 1000, group: 'gpt' },
  gpt_quotes:      { sp: 'quotes',      label: 'Цитаты (сводка)',      type: 'string', maxLength: 1000, group: 'gpt' },
  gpt_affirmation: { sp: 'affirmation', label: 'Аффирмации (сводка)',  type: 'string', maxLength: 1000, group: 'gpt' },
  gpt_mycontext:   { sp: 'mycontext',   label: 'Мой контекст',         type: 'string', maxLength: 1000, group: 'gpt' },

  // === Ежедневные (из CSV, используются ботом) ===
  affirm:      { sp: 'affirm',      label: 'Аффирмация дня',    type: 'string', maxLength: 1000, group: 'daily' },
  video:       { sp: 'video',       label: 'Цитата дня',        type: 'string', maxLength: 1000, group: 'daily' },
  msg_count:   { sp: 'msg_count',   label: 'Счётчик сообщений', type: 'int',    min: 0, max: 9999, group: 'daily' },
  sprint_task: { sp: 'sprint_task', label: 'Задача спринта',    type: 'string', maxLength: 1000, group: 'daily' },
};

/** All internal field keys */
export const ALL_KEYS = Object.keys(VARIABLE_MAP);

/** Группы для UI */
export const GROUPS = {
  quick:           { label: 'Быстро',              order: 0 },
  profile:         { label: 'Профиль',             order: 1 },
  affirmations:    { label: 'Аффирмации',          order: 2 },
  quotes:          { label: 'Цитаты',              order: 3 },
  links:           { label: 'Связки',              order: 4 },
  morning_evening: { label: 'Утро и вечер',        order: 5 },
  gpt:             { label: 'Инструкции ChatGPT',  order: 6 },
  razbor_sendpulse:{ label: 'Разбор → SendPulse',  order: 7 },
  daily:           { label: 'Ежедневные',          order: 8 },
};

/** Критичные поля — без них сохранение блокируется */
export const CRITICAL_FIELDS = ['tz', 't1', 't2'];

/** Короткий список таймзон */
export const TIMEZONES = [
  'UTC',
  'Europe/Moscow',
  'Europe/Kyiv',
  'Europe/Minsk',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Europe/Warsaw',
  'Asia/Almaty',
  'Asia/Tashkent',
  'Asia/Tbilisi',
  'Asia/Yerevan',
  'Asia/Dubai',
  'America/New_York',
  'America/Los_Angeles',
];

/** Emoji regex for name validation */
const EMOJI_RE = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/u;

/** Time HH:MM regex */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a single field value.
 * @returns {string|null} error message or null if valid
 */
export function validateField(key, value) {
  const def = VARIABLE_MAP[key];
  if (!def) return `Неизвестное поле: ${key}`;

  // Allow empty for non-required fields
  if ((value === '' || value === null || value === undefined) && !def.required) {
    return null;
  }

  // Required field must not be empty
  if (def.required && (value === '' || value === null || value === undefined)) {
    return `${def.label} обязательно`;
  }

  const str = String(value);

  switch (def.type) {
    case 'int': {
      const n = Number(value);
      if (!Number.isInteger(n)) return `${def.label}: должно быть целым числом`;
      if (def.min !== undefined && n < def.min) return `${def.label}: минимум ${def.min}`;
      if (def.max !== undefined && n > def.max) return `${def.label}: максимум ${def.max}`;
      break;
    }
    case 'string':
      if (def.maxLength && str.length > def.maxLength) {
        return `${def.label}: максимум ${def.maxLength} символов (сейчас ${str.length})`;
      }
      if (def.noEmoji && EMOJI_RE.test(str)) {
        return `${def.label}: emoji не разрешены`;
      }
      break;
    case 'time':
      if (!TIME_RE.test(str)) return `${def.label}: формат HH:MM`;
      break;
    case 'timezone':
      if (!TIMEZONES.includes(str)) return `${def.label}: выберите из списка`;
      break;
    case 'enum':
      if (!def.values.includes(str)) return `${def.label}: допустимые значения: ${def.values.join(', ')}`;
      break;
    case 'uuid':
      if (!UUID_RE.test(str)) return `${def.label}: некорректный UUID`;
      break;
  }

  return null;
}

/**
 * Validate a set of changes. Returns { valid: bool, errors: { field: message } }
 */
export function validateChanges(changes) {
  const errors = {};
  for (const [key, value] of Object.entries(changes)) {
    const err = validateField(key, value);
    if (err) errors[key] = err;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Convert internal state → SendPulse variables object { sp_name: value }
 * @param {Object} data - key-value pairs to convert
 * @param {string|null} clientTz - client IANA timezone for t1/t2 conversion
 * @param {Set|null} explicitKeys - keys explicitly changed by user (for manualOnly filtering)
 *   If null, all keys in data are treated as explicit.
 */
export function toSendPulse(data, clientTz = null, explicitKeys = null) {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    const def = VARIABLE_MAP[key];
    if (!def || !def.sp || def.dbOnly) continue;

    // manualOnly fields: skip unless explicitly changed by user
    if (def.manualOnly && explicitKeys && !explicitKeys.has(key)) continue;

    // Convert time fields from client timezone to Lisbon
    if (clientTz && (key === 't1' || key === 't2') && value) {
      result[def.sp] = convertTimeToLisbon(value, clientTz);
    } else {
      result[def.sp] = value;
    }
  }
  return result;
}

const BOT_TIMEZONE = process.env.BOT_TIMEZONE || 'UTC';
export const RAZBOR_SLOT_MAX_LENGTH = 1000;
export const RAZBOR_FALSE_KEYS = Array.from(
  { length: 10 },
  (_, index) => `razbor_false_${String(index + 1).padStart(2, '0')}`
);
export const RAZBOR_NEW_KEYS = Array.from(
  { length: 10 },
  (_, index) => `razbor_new_${String(index + 1).padStart(2, '0')}`
);

/**
 * Legacy function name: convert HH:MM from clientTz to configured BOT_TIMEZONE.
 * Uses today's date for DST calculation.
 * @param {string} timeStr - "HH:MM"
 * @param {string} clientTz - IANA timezone (e.g. "Europe/Moscow")
 * @returns {string} "HH:MM" in configured bot time
 */
export function convertTimeToLisbon(timeStr, clientTz) {
  return convertTimeBetweenZones(timeStr, clientTz, BOT_TIMEZONE);
}

/** Convert a wall-clock schedule using today's offsets; revisit recurring schedules at DST changes. */
export function convertTimeBetweenZones(timeStr, fromZone, toZone, date = new Date()) {
  if (!timeStr || !fromZone || !toZone || fromZone === toZone) return timeStr;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) return timeStr;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const wall = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes);
  const offsetAt = (instant, zone) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - instant;
  };
  let instant = wall - offsetAt(wall, fromZone);
  instant = wall - offsetAt(instant, fromZone);
  return new Intl.DateTimeFormat('en-GB', { timeZone: toZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant));
}

export function normalizeDerivedState(state) {
  const nextState = { ...(state || {}) };
  if (
    Object.prototype.hasOwnProperty.call(nextState, 'gpt_situation') ||
    Object.prototype.hasOwnProperty.call(nextState, 'link_main')
  ) {
    const mirroredValue = Object.prototype.hasOwnProperty.call(nextState, 'gpt_situation')
      ? String(nextState.gpt_situation || '')
      : String(nextState.link_main || '');
    nextState.gpt_situation = mirroredValue;
    nextState.link_main = mirroredValue;
  }
  if (Object.prototype.hasOwnProperty.call(nextState, 'published_link_progress')) {
    const progress = Number(nextState.published_link_progress);
    nextState.published_link_progress = Number.isFinite(progress) && progress >= 0
      ? Math.floor(progress)
      : 0;
  }
  return nextState;
}

export function deriveStateChanges(currentState, changes) {
  const safeCurrentState = currentState && typeof currentState === 'object' ? currentState : {};
  const safeChanges = changes && typeof changes === 'object' ? changes : {};
  const mergedState = normalizeDerivedState({
    ...safeCurrentState,
    ...safeChanges,
  });
  const result = { ...safeChanges };

  const linkTextChanged =
    Object.prototype.hasOwnProperty.call(safeChanges, 'gpt_situation') ||
    Object.prototype.hasOwnProperty.call(safeChanges, 'link_main');

  if (linkTextChanged) {
    const currentMirroredValue = String(
      safeCurrentState.gpt_situation ?? safeCurrentState.link_main ?? ''
    );
    const nextMirroredValue = String(mergedState.gpt_situation || '');

    result.gpt_situation = nextMirroredValue;
    result.link_main = nextMirroredValue;

    if (currentMirroredValue !== nextMirroredValue) {
      result.published_link_id = null;
      result.published_link_progress = 0;
    }
  }

  return result;
}

export function appendTextToSlotFields(currentState, slotKeys, incomingText, maxLength = RAZBOR_SLOT_MAX_LENGTH) {
  const keys = Array.isArray(slotKeys) ? slotKeys : [];
  const addition = String(incomingText || '').trim();
  if (!keys.length || !addition) return {};

  let combined = keys.map((key) => String(currentState?.[key] || '')).join('');
  if (combined && !combined.endsWith('\n')) {
    combined += '\n';
  }
  combined += addition;

  const maxTotalLength = keys.length * maxLength;
  if (combined.length > maxTotalLength) {
    combined = combined.slice(combined.length - maxTotalLength);
  }

  const changes = {};
  keys.forEach((key, index) => {
    changes[key] = combined.slice(index * maxLength, (index + 1) * maxLength);
  });
  return changes;
}

/**
 * Get timezone offset in minutes (positive = east of UTC) for a given local time.
 * Uses Intl.DateTimeFormat to resolve DST correctly.
 */
function getTimezoneOffsetMinutes(year, month, day, hours, minutes, tz) {
  // Create a date in UTC
  const utcDate = new Date(Date.UTC(year, month, day, hours, minutes));

  // Format in the target timezone to get the local representation
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const parts = {};
  for (const p of formatter.formatToParts(utcDate)) {
    parts[p.type] = p.value;
  }

  const localH = parseInt(parts.hour === '24' ? '0' : parts.hour);
  const localM = parseInt(parts.minute);
  const localDay = parseInt(parts.day);

  // Simple offset: difference between local and UTC
  let diffMinutes = (localH * 60 + localM) - (hours * 60 + minutes);

  // Adjust for day boundary crossing
  if (localDay !== day) {
    diffMinutes += (localDay > day ? 1440 : -1440);
  }

  return diffMinutes;
}

/**
 * Convert SendPulse variables → internal state { internal_key: value }
 */
export function fromSendPulse(spVars, clientTz = null) {
  const result = {};
  // Build reverse map: sp_name → internal_key
  for (const [key, def] of Object.entries(VARIABLE_MAP)) {
    if (def.sp && !def.dbOnly && spVars[def.sp] !== undefined) {
      result[key] = spVars[def.sp];
    }
  }
  const targetZone = clientTz || result.tz;
  if (targetZone) {
    for (const key of ['t1', 't2']) if (result[key]) result[key] = convertTimeBetweenZones(result[key], BOT_TIMEZONE, targetZone);
  }

  return result;
}

/**
 * Find which fields changed between old and new state.
 * @returns {Object} only the changed key-value pairs from newData
 */
export function diffFields(oldData, newData) {
  const changed = {};
  for (const [key, value] of Object.entries(newData)) {
    if (String(oldData[key] ?? '') !== String(value ?? '')) {
      changed[key] = value;
    }
  }
  return changed;
}

// --- Default quote packs ---

const QUOTES_BASE = [
  'Дефект виден снаружи, а причина обычно спрятана в интерпретации между стимулом и реакцией.',
  'Сильная эмоция не доказывает истинность вывода — она показывает, что задет шаблон.',
  'Там, где появляется связка «стимул → интерпретация → реакция», появляется точка выбора.',
  'Без фиксации повторы кажутся случайными; с фиксацией видна система.',
  'Один и тот же внутренний шаблон может давать разные внешние дефекты — ищи корень, а не симптом.',
  'За каждым автоматическим «надо / нельзя / опасно» стоит конкретная интерпретация, которую можно проверить.',
  'Прогресс в исследовании — это не идеальный день, а более раннее распознавание автопилота.',
  'Большинство реакций запускается не ситуацией, а тем, что ты решил о ситуации до того, как успел подумать.',
  'Чем точнее назван триггер и интерпретация, тем проще потом изменить реакцию.',
  'Карта шаблонов ценна не сама по себе, а тем, что показывает, где именно ты теряешь выбор.',
];

const QUOTES_PRO = [
  'Баг исчезает не от обещаний, а от смены интерпретации в момент триггера.',
  'Быстрый импульс идёт из старого шаблона, а не из текущей реальности — его можно не слушаться.',
  'Одна точная реакция в сложном моменте ценнее десяти правильных мыслей заранее.',
  'Пока корневая интерпретация не найдена, симптом будет возвращаться под новым видом.',
  'Управляемость растёт, когда ты видишь конкретный шаг, на котором обычно теряешь выбор.',
  'Реакция уже пошла — это не конец: точка выбора есть в каждом следующем шаге.',
  'Новый результат требует не героизма, а повторяемой точности в одном и том же месте.',
  'Чем раньше замечен триггер, тем меньше усилий стоит новый выбор.',
  'Шаблон ослабевает не когда ты его подавляешь, а когда у тебя есть чем его заменить.',
  'Баг закрыт, когда при типичном триггере новая реакция включается без усилия.',
];

/**
 * Get default quotes for a given pack.
 * @param {'base'|'pro'} pack
 * @returns {{ q1..q10: string }}
 */
export function getDefaultQuotes(pack) {
  const quotes = pack === 'pro' ? QUOTES_PRO : QUOTES_BASE;
  const result = {};
  for (let i = 0; i < 10; i++) {
    result[`q${i + 1}`] = quotes[i];
  }
  return result;
}

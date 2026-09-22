const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateUtc(value) {
  const str = String(value || '').trim();
  if (!DATE_RE.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

export function getDefaultPeriod(days = 7) {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 7;
  const end = new Date();
  const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const startUtc = new Date(endUtc.getTime() - (safeDays - 1) * DAY_MS);
  return {
    dateFrom: toDateString(startUtc),
    dateTo: toDateString(endUtc),
  };
}

export function parsePeriodInput(rawFrom, rawTo, maxDays = 90) {
  const defaults = getDefaultPeriod(7);
  const dateFromStr = String(rawFrom || defaults.dateFrom).trim();
  const dateToStr = String(rawTo || defaults.dateTo).trim();

  const dateFrom = parseDateUtc(dateFromStr);
  const dateTo = parseDateUtc(dateToStr);
  if (!dateFrom || !dateTo) {
    return { error: 'Период должен быть в формате YYYY-MM-DD' };
  }
  if (dateFrom.getTime() > dateTo.getTime()) {
    return { error: 'date_from не может быть позже date_to' };
  }

  const totalDays = Math.floor((dateTo.getTime() - dateFrom.getTime()) / DAY_MS) + 1;
  const safeMaxDays = Number.isFinite(maxDays) && maxDays > 0 ? Math.floor(maxDays) : 90;
  if (totalDays > safeMaxDays) {
    return { error: `Максимальный период: ${safeMaxDays} дней` };
  }

  return {
    dateFrom: toDateString(dateFrom),
    dateTo: toDateString(dateTo),
    totalDays,
  };
}

export function clampLimit(rawLimit, fallback = 100, max = 200) {
  const n = Number(rawLimit);
  if (!Number.isFinite(n)) return fallback;
  if (n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export function buildDiarySummaryInput(entries, maxChars = 30000) {
  const list = Array.isArray(entries) ? entries : [];
  const blocks = list.map((entry, idx) => {
    const localDate = String(entry.local_date || '').trim();
    const createdAt = String(entry.created_at || '').trim();
    const source = String(entry.source || '').trim();
    const text = String(entry.text || '').trim();
    return [
      `Запись ${idx + 1}`,
      `local_date: ${localDate}`,
      `created_at: ${createdAt}`,
      `source: ${source || 'unknown'}`,
      'text:',
      text,
    ].join('\n');
  });

  const full = blocks.join('\n\n---\n\n').trim();
  if (!full) {
    return {
      input: '',
      truncated: false,
      totalChars: 0,
      inputChars: 0,
      entriesCount: list.length,
    };
  }

  const safeMaxChars = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : 30000;
  if (full.length <= safeMaxChars) {
    return {
      input: full,
      truncated: false,
      totalChars: full.length,
      inputChars: full.length,
      entriesCount: list.length,
    };
  }

  const tail = full.slice(-safeMaxChars);
  const notice = `ВНИМАНИЕ: вход сокращен до последних ${safeMaxChars} символов из ${full.length}.\n\n`;
  const input = `${notice}${tail}`;
  return {
    input,
    truncated: true,
    totalChars: full.length,
    inputChars: input.length,
    entriesCount: list.length,
  };
}

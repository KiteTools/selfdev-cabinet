import { formatDate } from './date.js';
import { $ } from './dom.js';

export function parseDateOnlyUtc(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Date(Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  ));
}

export function formatDiaryPeriodHuman(dateFrom, dateTo) {
  const from = parseDateOnlyUtc(dateFrom);
  const to = parseDateOnlyUtc(dateTo);
  if (!from || !to) {
    const fromText = dateFrom ? formatDate(dateFrom) : '—';
    const toText = dateTo ? formatDate(dateTo) : '—';
    return `с ${fromText} по ${toText}`;
  }

  const fromDay = from.getUTCDate();
  const toDay = to.getUTCDate();
  const fromMonth = from.toLocaleDateString('ru-RU', { month: 'long', timeZone: 'UTC' });
  const toMonth = to.toLocaleDateString('ru-RU', { month: 'long', timeZone: 'UTC' });
  const fromYear = from.getUTCFullYear();
  const toYear = to.getUTCFullYear();

  if (from.getTime() === to.getTime()) {
    return `${fromDay} ${fromMonth} ${fromYear} года`;
  }
  if (fromYear === toYear) {
    if (fromMonth === toMonth) {
      return `с ${fromDay} по ${toDay} ${toMonth} ${toYear} года`;
    }
    return `с ${fromDay} ${fromMonth} по ${toDay} ${toMonth} ${toYear} года`;
  }
  return `с ${fromDay} ${fromMonth} ${fromYear} года по ${toDay} ${toMonth} ${toYear} года`;
}

export function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getPresetRange(preset) {
  const days = Number(preset);
  if (!Number.isFinite(days) || days <= 0) return null;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return {
    dateFrom: toYmd(start),
    dateTo: toYmd(end),
  };
}

export function applyPresetToInputs(preset, fromSelector, toSelector) {
  const range = getPresetRange(preset);
  if (!range) return;
  const fromInput = $(fromSelector);
  const toInput = $(toSelector);
  if (fromInput) fromInput.value = range.dateFrom;
  if (toInput) toInput.value = range.dateTo;
}

export function applyDiaryPreset(preset) {
  applyPresetToInputs(preset, '#diary-date-from', '#diary-date-to');
}

export function applyRetroPreset(preset) {
  applyPresetToInputs(preset, '#retro-date-from', '#retro-date-to');
}

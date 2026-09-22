import { $ } from './dom.js';

export function createTextareaField(key, label, rows, extraClass = '') {
  const div = document.createElement('div');
  div.className = 'space-y-2';
  const textareaClass = [
    'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-y',
    extraClass,
  ].filter(Boolean).join(' ');
  div.innerHTML = `
    <label for="f-${key}" class="text-sm font-semibold text-slate-700 dark:text-slate-300">${label}</label>
    <textarea id="f-${key}" data-key="${key}" rows="${rows}" class="${textareaClass}"></textarea>
  `;
  return div;
}

export function generateAffirmationFields() {
  const container = $('#group-affirmations');
  if (!container || container.childElementCount) return;
  for (let i = 1; i <= 10; i++) {
    const key = `aff${i}`;
    container.appendChild(createTextareaField(key, `Аффирмация ${i}`, 2, 'desktop-tall-textarea'));
  }
}

export function generateQuoteFields() {
  const container = $('#group-quotes');
  if (!container || container.childElementCount) return;
  for (let i = 1; i <= 10; i++) {
    const key = `q${i}`;
    container.appendChild(createTextareaField(key, `Цитата ${i}`, 2, 'desktop-tall-textarea'));
  }
}

export function generateGptFields(fields) {
  const container = $('#group-gpt');
  if (!container || container.childElementCount) return;
  for (const { key, label } of fields) {
    container.appendChild(createTextareaField(key, label, 4));
  }
}

import { $ } from './dom.js';

const TOAST_ICONS = {
  success: 'check_circle',
  info: 'info',
  warning: 'warning',
  error: 'error',
};

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
  const el = $(`#${id}`);
  if (el) el.classList.add('active');
}

export function setStatus(text, type) {
  const bar = $('#status-bar');
  const span = $('#status-text');
  if (!bar || !span) return;
  bar.className = `status-bar ${type || ''}`.trim();
  span.textContent = text;
}

export function smoothScrollToElement(el, block = 'start') {
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block, inline: 'nearest' });
  });
}

export function smoothScrollToBottom() {
  requestAnimationFrame(() => {
    const maxTop = Math.max(
      document.documentElement?.scrollHeight || 0,
      document.body?.scrollHeight || 0
    );
    window.scrollTo({ top: maxTop, behavior: 'smooth' });
  });
}

export function showAppModal(message, title = 'Готово') {
  const modal = $('#app-modal');
  if (!modal) return;
  const titleEl = $('#app-modal-title');
  const messageEl = $('#app-modal-message');
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  modal.setAttribute('aria-hidden', 'false');
}

export function hideAppModal() {
  const modal = $('#app-modal');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
}

function ensureToastStack() {
  const existing = $('#app-toast-stack');
  if (existing) return existing;

  const stack = document.createElement('div');
  stack.id = 'app-toast-stack';
  stack.className = 'app-toast-stack';
  stack.setAttribute('aria-live', 'polite');
  stack.setAttribute('aria-atomic', 'false');
  document.body.appendChild(stack);
  return stack;
}

function dismissToast(toast) {
  if (!toast || toast.dataset.state === 'closing') return;
  toast.dataset.state = 'closing';
  const timerId = Number(toast.dataset.dismissTimer || 0);
  if (timerId) {
    window.clearTimeout(timerId);
  }
  window.setTimeout(() => {
    toast.remove();
  }, 180);
}

export function showToast(message, { title = 'Готово', type = 'info', duration = 4200 } = {}) {
  const text = String(message || '').trim();
  if (!text) return null;

  const stack = ensureToastStack();
  const resolvedType = TOAST_ICONS[type] ? type : 'info';
  const toast = document.createElement('article');
  toast.className = `app-toast ${resolvedType}`;
  toast.dataset.state = 'hidden';

  const body = document.createElement('div');
  body.className = 'app-toast-body';

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined app-toast-icon';
  icon.textContent = TOAST_ICONS[resolvedType];

  const content = document.createElement('div');
  content.className = 'app-toast-content';

  const titleEl = document.createElement('strong');
  titleEl.className = 'app-toast-title';
  titleEl.textContent = String(title || 'Готово').trim();

  const messageEl = document.createElement('p');
  messageEl.className = 'app-toast-message';
  messageEl.textContent = text;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'app-toast-close';
  closeBtn.setAttribute('aria-label', 'Закрыть уведомление');
  closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
  closeBtn.addEventListener('click', () => dismissToast(toast));

  content.append(titleEl, messageEl);
  body.append(icon, content);
  toast.append(body, closeBtn);
  stack.prepend(toast);

  requestAnimationFrame(() => {
    toast.dataset.state = 'visible';
  });

  if (duration > 0) {
    const timerId = window.setTimeout(() => dismissToast(toast), duration);
    toast.dataset.dismissTimer = String(timerId);
  }

  return toast;
}

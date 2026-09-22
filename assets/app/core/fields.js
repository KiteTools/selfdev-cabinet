import { $$ } from './dom.js';

let textareaResizeObserver = null;

function isTextarea(el) {
  return el instanceof HTMLTextAreaElement;
}

function getTextareaResizeObserver() {
  if (typeof ResizeObserver !== 'function') return null;
  if (textareaResizeObserver) return textareaResizeObserver;

  textareaResizeObserver = new ResizeObserver((entries) => {
    entries.forEach(({ target }) => {
      autosizeTextarea(target);
    });
  });

  return textareaResizeObserver;
}

function getTextareaMinHeight(el) {
  const storedMinHeight = Number(el.dataset.autosizeMinHeight || 0);
  if (storedMinHeight > 0) return storedMinHeight;

  const styles = window.getComputedStyle(el);
  const rows = Math.max(Number(el.getAttribute('rows')) || 1, 1);
  const fontSize = parseFloat(styles.fontSize) || 16;
  const lineHeight = parseFloat(styles.lineHeight) || Math.round(fontSize * 1.5);
  const paddingHeight =
    (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
  const borderHeight =
    (parseFloat(styles.borderTopWidth) || 0) + (parseFloat(styles.borderBottomWidth) || 0);
  const cssMinHeight = parseFloat(styles.minHeight) || 0;
  const minHeight = Math.max(Math.ceil(rows * lineHeight + paddingHeight + borderHeight), cssMinHeight);

  el.dataset.autosizeMinHeight = String(minHeight);
  return minHeight;
}

export function autosizeTextarea(el) {
  if (!isTextarea(el)) return;

  el.classList.add('autosize-textarea');
  el.style.height = 'auto';
  el.style.overflowY = 'hidden';
  el.style.height = `${Math.max(el.scrollHeight, getTextareaMinHeight(el))}px`;
}

export function registerAutosizeTextarea(el) {
  if (!isTextarea(el)) return;

  autosizeTextarea(el);

  if (el.dataset.autosizeObserved === 'true') return;
  const observer = getTextareaResizeObserver();
  observer?.observe(el);
  el.dataset.autosizeObserved = 'true';
}

export function autosizeTextareas(root = document) {
  root.querySelectorAll?.('textarea[data-key]').forEach((el) => {
    registerAutosizeTextarea(el);
  });
}

export function syncFieldUiValue(key, value) {
  const elements = $$(`[data-key="${key}"]`);
  if (!elements.length) return;
  elements.forEach((el) => {
    if (el.type === 'radio') {
      el.checked = String(el.value) === String(value ?? '');
    } else {
      el.value = value ?? '';
      if (isTextarea(el)) {
        registerAutosizeTextarea(el);
      }
    }
  });
}

import { escapeHtml } from './html.js';

function formatInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>');
}

export function renderMarkdown(md) {
  const lines = String(md || '').split(/\r?\n/);
  let html = '';
  let inCode = false;
  let codeBuffer = [];
  let listType = null;
  let listItems = [];

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    const tag = listType === 'ol' ? 'ol' : 'ul';
    html += `<${tag}>${listItems.map((item) => `<li>${item}</li>`).join('')}</${tag}>`;
    listType = null;
    listItems = [];
  };

  const flushCode = () => {
    if (!inCode) return;
    html += `<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`;
    inCode = false;
    codeBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('```')) {
      if (inCode) {
        flushCode();
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(rawLine);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      html += `<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`;
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(formatInlineMarkdown(orderedMatch[1]));
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(formatInlineMarkdown(unorderedMatch[1]));
      continue;
    }

    if (!line.trim()) {
      flushList();
      html += '<div class="md-spacer"></div>';
      continue;
    }

    flushList();
    html += `<p>${formatInlineMarkdown(line)}</p>`;
  }

  flushList();
  if (inCode) flushCode();

  return html;
}

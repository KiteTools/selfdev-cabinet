export function escapeHtml(str) {
  if (typeof document === 'undefined') {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

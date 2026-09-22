export function createThemeController() {
  function applyTheme(dark) {
    const html = document.documentElement;
    if (dark) {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
    }
  }

  function initTheme() {
    const saved = localStorage.getItem('lk_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved === 'dark' || (!saved && prefersDark);
    applyTheme(dark);
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    const next = !isDark;
    applyTheme(next);
    localStorage.setItem('lk_theme', next ? 'dark' : 'light');
  }

  return {
    applyTheme,
    initTheme,
    toggleTheme,
  };
}

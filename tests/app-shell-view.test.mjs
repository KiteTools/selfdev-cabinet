import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('app shell keeps production tab wiring while exposing semantic app shell classes', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../assets/styles.css', import.meta.url), 'utf8');

  assert.match(html, /<header class="[^"]*app-shell-header/);
  assert.match(html, /class="[^"]*app-shell-brand/);
  assert.match(html, /class="[^"]*sections-nav[^"]*app-shell-tabs/);
  assert.match(html, /class="[^"]*tab[^"]*app-shell-tab[^"]*" data-tab="dashboard"/);
  assert.match(html, /class="[^"]*tab[^"]*app-shell-tab[^"]*" data-tab="retro"/);
  assert.match(html, /id="btn-theme-toggle" class="[^"]*app-shell-theme-toggle/);
  assert.match(html, /id="status-bar" class="[^"]*status-bar[^"]*app-shell-status/);
  assert.match(css, /\.app-shell-header\s*\{/);
  assert.match(css, /\.app-shell-brand\s*\{/);
  assert.match(css, /\.app-shell-tab\s*\{/);
  assert.match(css, /\.app-brand-mark\s*\{/);
});

test('app shell keeps all existing production tabs available', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  [
    'dashboard',
    'quick',
    'settings',
    'consultations',
    'diaries',
    'razbor',
    'links',
    'retro',
  ].forEach((tabId) => {
    assert.match(html, new RegExp(`data-tab="${tabId}"`));
    assert.match(html, new RegExp(`id="tab-${tabId}"`));
  });
});

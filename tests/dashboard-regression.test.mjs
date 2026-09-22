import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('dashboard feature files exist and are wired into app bootstrap', () => {
  const appJs = fs.readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  const tabsJs = fs.readFileSync(new URL('../assets/app/core/tabs.js', import.meta.url), 'utf8');
  const appInitJs = fs.readFileSync(new URL('../assets/app/core/app-init.js', import.meta.url), 'utf8');
  const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const stylesCss = fs.readFileSync(new URL('../assets/styles.css', import.meta.url), 'utf8');

  assert.equal(fs.existsSync(new URL('../assets/app/features/dashboard.js', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../assets/app/features/dashboard-model.mjs', import.meta.url)), true);
  assert.match(appJs, /createDashboardController/);
  assert.match(appJs, /openDashboardTab/);
  assert.match(appJs, /bindDashboardEvents/);
  assert.match(appJs, /onDashboardTab/);
  assert.match(tabsJs, /target === 'dashboard'/);
  assert.match(tabsJs, /activateTab\('dashboard'\)/);
  assert.match(tabsJs, /dashboard-tab-active/);
  assert.match(appInitJs, /bindDashboardEvents/);
  assert.match(indexHtml, /data-tab="dashboard"/);
  assert.match(indexHtml, /id="tab-dashboard"/);
  assert.match(indexHtml, /dashboard-toolbar-actions/);
  assert.match(indexHtml, /dashboard-lower-grid/);
  assert.match(stylesCss, /\.dashboard-card/);
  assert.match(stylesCss, /\.dashboard-focus-title/);
});

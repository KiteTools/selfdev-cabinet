import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('shared layout primitives expose panel, field, accordion, toast, and modal hooks', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../assets/styles.css', import.meta.url), 'utf8');
  const uiJs = fs.readFileSync(new URL('../assets/app/core/ui.js', import.meta.url), 'utf8');

  assert.match(css, /\.lk-panel\s*\{/);
  assert.match(css, /\.lk-panel-muted\s*\{/);
  assert.match(css, /\.lk-form-field\s*\{/);
  assert.match(css, /\.lk-modal-dialog\s*\{/);
  assert.match(css, /\.action-btn\s*\{/);
  assert.match(css, /\.status-bar\s*\{/);
  assert.match(css, /\.accordion\s*\{/);
  assert.match(css, /\.app-toast\s*\{/);
  assert.match(uiJs, /app-toast/);
  assert.match(html, /id="consul-upload" class="[^"]*lk-panel/);
  assert.match(html, /class="[^"]*accordion[^"]*lk-panel/);
  assert.match(html, /class="[^"]*lk-form-field[^"]*"[\s\S]*id="f-t1"/);
  assert.match(html, /class="[^"]*app-modal-dialog[^"]*lk-modal-dialog/);
});

test('core production tabs keep their current sections while gaining semantic panel hooks', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /id="tab-dashboard"/);
  assert.match(html, /id="tab-quick"/);
  assert.match(html, /id="tab-settings"/);
  assert.match(html, /id="tab-consultations"/);
  assert.match(html, /id="tab-diaries"/);
  assert.match(html, /id="tab-razbor"/);
  assert.match(html, /id="tab-links"/);
  assert.match(html, /id="tab-retro"/);
  assert.match(html, /id="tab-quick"[\s\S]*lk-panel/);
  assert.match(html, /id="tab-links"[\s\S]*lk-panel/);
  assert.match(html, /id="tab-retro"[\s\S]*lk-panel/);
});

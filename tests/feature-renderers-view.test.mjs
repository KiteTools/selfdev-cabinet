import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('runtime feature renderers expose semantic card and history hooks for the new design system', () => {
  const consultationsJs = fs.readFileSync(new URL('../assets/app/features/consultations.js', import.meta.url), 'utf8');
  const linksJs = fs.readFileSync(new URL('../assets/app/features/links.js', import.meta.url), 'utf8');
  const retroJs = fs.readFileSync(new URL('../assets/app/features/retro.js', import.meta.url), 'utf8');
  const razborJs = fs.readFileSync(new URL('../assets/app/features/razbor.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../assets/styles.css', import.meta.url), 'utf8');

  assert.match(consultationsJs, /lk-history-item/);
  assert.match(retroJs, /lk-history-item/);
  assert.match(razborJs, /lk-history-item/);
  assert.match(linksJs, /lk-link-card/);
  assert.match(linksJs, /lk-suggestion-card/);
  assert.match(linksJs, /lk-report-card/);
  assert.match(linksJs, /lk-metric-card/);
  assert.match(retroJs, /lk-success-card/);
  assert.match(css, /\.lk-history-item\s*\{/);
  assert.match(css, /\.lk-link-card\s*\{/);
  assert.match(css, /\.lk-suggestion-card\s*\{/);
  assert.match(css, /\.lk-report-card\s*\{/);
  assert.match(css, /\.lk-metric-card\s*\{/);
  assert.match(css, /\.lk-success-card\s*\{/);
});

test('dashboard visual layer adopts token-backed glass surfaces instead of the old hardcoded accent styling', () => {
  const css = fs.readFileSync(new URL('../assets/styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.dashboard-card\s*\{[\s\S]*background:\s*var\(--lk-panel-elevated\)/);
  assert.match(css, /\.dashboard-card\s*\{[\s\S]*border:\s*1px solid var\(--lk-border\)/);
  assert.match(css, /\.dashboard-focus-card\s*\{[\s\S]*rgba\(20,\s*184,\s*166/);
  assert.match(css, /\.dashboard-stat strong\s*\{[\s\S]*var\(--lk-accent-strong\)/);
  assert.match(css, /\.dashboard-progress-bar\s*\{[\s\S]*var\(--lk-surface-muted\)/);
});

test('consultation apply confirm has an in-place live status next to the button', () => {
  const consultationsJs = fs.readFileSync(new URL('../assets/app/features/consultations.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../assets/styles.css', import.meta.url), 'utf8');

  assert.match(consultationsJs, /id="consul-apply-local-status"/);
  assert.match(consultationsJs, /aria-live="polite"/);
  assert.match(consultationsJs, /setConsultationApplyStatus\('Применяю саммари\.\.\.', 'saving'\)/);
  assert.match(consultationsJs, /setConsultationApplyStatus\('Саммари применено', 'saved'\)/);
  assert.match(css, /\.consul-apply-actions\s*\{/);
  assert.match(css, /\.consul-apply-status\[data-state="saving"\]/);
  assert.match(css, /\.consul-apply-status\[data-state="error"\]/);
});

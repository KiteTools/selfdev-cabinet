import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('design system defines shared light and dark theme tokens', () => {
  const css = fs.readFileSync(new URL('../assets/styles.css', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(css, /:root\s*\{[\s\S]*--lk-accent:\s*#14B8A6/i);
  assert.match(css, /:root\s*\{[\s\S]*--lk-surface:\s*#F8FAFC/i);
  assert.match(css, /\.dark\s*\{[\s\S]*--lk-panel:/i);
  assert.match(html, /tailwind\.config[\s\S]*extend:[\s\S]*colors:[\s\S]*primary:\s*"var\(--lk-accent\)"/i);
});

test('theme controller still persists class-based light and dark mode', () => {
  const themeJs = fs.readFileSync(new URL('../assets/app/core/theme.js', import.meta.url), 'utf8');

  assert.match(themeJs, /html\.classList\.add\('dark'\)/);
  assert.match(themeJs, /html\.classList\.add\('light'\)/);
  assert.match(themeJs, /localStorage\.setItem\('lk_theme'/);
});

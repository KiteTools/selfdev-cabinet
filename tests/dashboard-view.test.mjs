import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  renderFocusCard,
  renderPeriodCard,
} from '../assets/app/features/dashboard.js';

test('renderPeriodCard uses activity headline, compact legend, and dense metrics', () => {
  const html = renderPeriodCard({
    period: {
      days: 5,
      dateFrom: '2026-04-06',
      dateTo: '2026-04-10',
      note: '',
    },
    metrics: {
      diaries: { value: 7, label: 'Дневники', hint: 'записи за период' },
      successes: { value: 3, label: 'Успехи', hint: 'raw-успехи' },
      signals: { value: 2, label: 'Сигналы', hint: 'ожидают разбора' },
      newLinks: { value: 1, label: 'Новые связки', hint: 'созданы за период' },
      razbor: { value: 0, label: 'Разборы', hint: 'завершены за период' },
      confirmations: { value: 0, label: 'Подтверждения', hint: 'по связке в фокусе' },
    },
    progressSegments: [
      { key: 'diaries', label: 'Дневники', value: 7, percent: 58 },
      { key: 'successes', label: 'Успехи', value: 3, percent: 25 },
      { key: 'signals', label: 'Сигналы', value: 2, percent: 17 },
      { key: 'newLinks', label: 'Новые связки', value: 0, percent: 0 },
      { key: 'razbor', label: 'Разборы', value: 0, percent: 0 },
      { key: 'confirmations', label: 'Подтверждения', value: 0, percent: 0 },
    ],
  }, () => 'с 6 по 10 апреля 2026 года');

  assert.match(html, /5 дней активности/);
  assert.match(html, /dashboard-progress-chip/);
  assert.match(html, /Дневники/);
  assert.match(html, /Успехи/);
  assert.match(html, /Сигналы/);
  assert.doesNotMatch(html, /7 дневников|3 успеха|1 новая связка/);
  assert.doesNotMatch(html, /записи за период|raw-успехи|ожидают разбора|созданы за период/);
});

test('renderFocusCard exposes stronger title and detail label classes', () => {
  const html = renderFocusCard({
    focus: {
      isEmpty: false,
      title: 'Успех определяется ускорением к жизни',
      text: '',
      stimulus: 'Вижу локальный провал',
      reaction: 'Начинаю закрывать боль',
      oldBelief: 'Ошибка опасна',
      newBelief: 'Факт можно выдержать',
      newActions: 'Сначала назвать факт',
      signals: 4,
      confirmations: 0,
    },
  });

  assert.match(html, /dashboard-focus-title/);
  assert.match(html, /dashboard-focus-detail-label/);
});

test('dashboard layout uses compact toolbar, integrated period metrics, and two-column lower grid', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /dashboard-action-btn/);
  assert.match(html, /dashboard-toolbar-actions/);
  assert.match(html, /dashboard-lower-grid/);
  assert.match(html, /dashboard-period-card/);
  assert.match(html, /data-tab="dashboard"/);
  assert.match(html, /id="tab-dashboard"/);
  assert.doesNotMatch(html, /id="dashboard-metrics"/);
});

test('dashboard typography keeps hero titles and key metrics below ultra-heavy black weights', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../assets/styles.css', import.meta.url), 'utf8');

  assert.doesNotMatch(html, /<h3 class="[^"]*font-black[^"]*">Дэшборд<\/h3>/);
  assert.match(css, /\.dashboard-focus-title\s*\{[\s\S]*color:\s*rgb\(30 41 59\);[\s\S]*font-weight:\s*700;/);
  assert.match(css, /\.dashboard-period-summary\s*\{[\s\S]*color:\s*rgb\(30 41 59\);[\s\S]*font-weight:\s*700;/);
  assert.match(css, /\.dashboard-period-metric-value\s*\{[\s\S]*color:\s*rgb\(30 41 59\);[\s\S]*font-weight:\s*800;/);
  assert.match(css, /\.dashboard-stat strong\s*\{[\s\S]*color:\s*var\(--lk-accent-strong\);[\s\S]*font-weight:\s*800;/);
});

test('dashboard styles use dashboard-only wide mode and denser desktop typography', () => {
  const css = fs.readFileSync(new URL('../assets/styles.css', import.meta.url), 'utf8');

  assert.match(css, /body\.dashboard-tab-active main/);
  assert.match(css, /\.dashboard-focus-title\s*\{[\s\S]*font-size:\s*clamp\(1\.55rem,\s*1\.95vw,\s*2\.45rem\)/);
  assert.match(css, /\.dashboard-focus-title\s*\{[\s\S]*max-width:\s*none/);
  assert.match(css, /\.dashboard-period-summary\s*\{[\s\S]*font-size:\s*clamp\(1\.4rem,\s*1\.6vw,\s*2rem\)/);
  assert.match(css, /\.dashboard-period-metrics\s*\{/);
  assert.match(css, /\.dashboard-progress-chip\s*\{/);
  assert.doesNotMatch(css, /\.dashboard-period-metrics\s*\{[\s\S]*margin-top:\s*auto/);
  assert.match(css, /@media \(min-width: 1280px\)[\s\S]*\.dashboard-lower-grid\s*\{[\s\S]*1\.12fr\)[\s\S]*0\.88fr\)/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.dashboard-event\s*\{[\s\S]*flex-direction:\s*column/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.dashboard-focus-title\s*\{[\s\S]*font-size:\s*clamp\(1\.2rem,\s*5\.8vw,\s*1\.7rem\)/);
  assert.match(css, /body\s*\{[\s\S]*overflow-x:\s*hidden/);
});

test('dashboard stats use flex alignment so metric values share the same baseline', () => {
  const css = fs.readFileSync(new URL('../assets/styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.dashboard-stat\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /\.dashboard-stat strong\s*\{[\s\S]*margin-top:\s*auto/);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDashboardViewModel,
  buildProgressSegments,
  deriveDashboardPeriod,
  getTodayYmd,
} from '../assets/app/features/dashboard-model.mjs';

test('deriveDashboardPeriod uses the latest completed consultation as period start', () => {
  const period = deriveDashboardPeriod([
    { id: 'old', status: 'completed', created_at: '2026-03-20T10:00:00.000Z' },
    { id: 'processing', status: 'processing', created_at: '2026-04-09T10:00:00.000Z' },
    { id: 'latest', status: 'completed', created_at: '2026-04-01T15:30:00.000Z' },
  ], '2026-04-10');

  assert.equal(period.dateFrom, '2026-04-01');
  assert.equal(period.dateTo, '2026-04-10');
  assert.equal(period.source, 'consultation');
  assert.equal(period.lastConsultation.id, 'latest');
  assert.equal(period.days, 10);
});

test('deriveDashboardPeriod falls back to the last 30 days without completed consultations', () => {
  const period = deriveDashboardPeriod([
    { id: 'processing', status: 'processing', created_at: '2026-04-09T10:00:00.000Z' },
  ], '2026-04-10');

  assert.equal(period.dateFrom, '2026-03-12');
  assert.equal(period.dateTo, '2026-04-10');
  assert.equal(period.source, 'fallback_30d');
  assert.equal(period.lastConsultation, null);
  assert.equal(period.days, 30);
  assert.equal(period.note, 'Консультаций пока нет, показаны последние 30 дней.');
});

test('getTodayYmd uses the local calendar date', () => {
  assert.equal(getTodayYmd(new Date(2026, 3, 10, 0, 30)), '2026-04-10');
});

test('buildDashboardViewModel aggregates focus, metrics, progress segments, and recent events', () => {
  const viewModel = buildDashboardViewModel({
    state: {
      name: 'Пример',
      published_link_id: 'link-1',
      published_link_progress: 8,
      link_main: 'Стимул: критика\nНовое действие: уточнять факт',
      q_morning: 'Где сегодня может включиться старый шаблон?',
      q_evening: 'Где получилось выбрать новую реакцию?',
      affirm: 'Я могу остановиться и выбрать действие.',
      video: 'Факт раньше интерпретации.',
    },
    consultations: [
      { id: 'consult-1', status: 'completed', created_at: '2026-04-01T15:30:00.000Z' },
    ],
    diaries: [
      { id: 'diary-1', local_date: '2026-04-02', source: 'sendpulse_voice', text: 'Заметила реакцию.' },
      { id: 'success-1', local_date: '2026-04-03', source: 'sendpulse_success', text: 'Получилось не спорить.' },
    ],
    links: {
      active_items: [
        {
          id: 'link-1',
          status: 'active',
          stimulus: 'Критика',
          reaction: 'Защищаться',
          old_belief: 'Меня обесценивают',
          new_belief: 'Можно уточнить факт',
          new_actions: 'Спросить, что конкретно не так',
          created_at: '2026-03-30T10:00:00.000Z',
          updated_at: '2026-04-04T10:00:00.000Z',
        },
        {
          id: 'link-2',
          status: 'active',
          stimulus: 'Молчание',
          reaction: 'Тревожиться',
          old_belief: 'Меня бросили',
          new_belief: 'Человек может быть занят',
          new_actions: 'Проверить факт через вопрос',
          created_at: '2026-04-05T10:00:00.000Z',
          updated_at: '2026-04-05T10:00:00.000Z',
        },
      ],
      inactive_items: [],
    },
    suggestions: [
      { id: 'suggestion-1', suggestion_type: 'progress_match', signal_text: 'Сегодня уточнила факт.', created_at: '2026-04-06T10:00:00.000Z' },
    ],
    linksReport: {
      active_link: { id: 'link-1', overall_progress: 8, confirmed_progress: 3 },
      links: [{ id: 'link-1', title: 'Можно уточнить факт', progress_events: 3 }],
      weeks: [],
    },
    razborHistory: [
      { id: 'razbor-1', summary_text: 'Разбор реакции на критику.', occurred_at: '2026-04-07T10:00:00.000Z' },
    ],
    retroStatus: {
      items: [{ id: 'retro-1', status: 'completed', date_from: '2026-04-01', date_to: '2026-04-10', updated_at: '2026-04-09T10:00:00.000Z' }],
    },
  }, { todayYmd: '2026-04-10' });

  assert.equal(viewModel.clientName, 'Пример');
  assert.equal(viewModel.period.dateFrom, '2026-04-01');
  assert.equal(viewModel.focus.id, 'link-1');
  assert.equal(viewModel.focus.title, 'Можно уточнить факт');
  assert.equal(viewModel.focus.signals, 8);
  assert.equal(viewModel.focus.confirmations, 3);
  assert.equal(viewModel.metrics.diaries.value, 2);
  assert.equal(viewModel.metrics.successes.value, 1);
  assert.equal(viewModel.metrics.signals.value, 1);
  assert.equal(viewModel.metrics.newLinks.value, 1);
  assert.equal(viewModel.metrics.razbor.value, 1);
  assert.equal(viewModel.metrics.confirmations.value, 3);
  assert.equal(viewModel.dailyContext.morningQuestion, 'Где сегодня может включиться старый шаблон?');
  assert.equal(viewModel.progressSegments.reduce((sum, item) => sum + item.value, 0), 9);
  assert.equal(viewModel.recentEvents[0].type, 'retro');
  assert.equal(viewModel.actions.openSummary.enabled, true);
  assert.equal(viewModel.actions.openSummary.consultationId, 'consult-1');
});

test('buildDashboardViewModel resolves production-shaped focus text and confirmations from report items', () => {
  const viewModel = buildDashboardViewModel({
    state: {
      name: 'Пример',
      link_main: 'Стимул: критика\nРеакция: защищаться\nНовое действие: уточнять факт',
      gpt_situation: 'Стимул: критика\nРеакция: защищаться\nСтарое понимание: меня обесценивают\nНовое понимание: можно уточнить факт\nНовые действия: спросить, что конкретно не так',
    },
    consultations: [
      { id: 'consult-2', status: 'completed', created_at: '2026-04-08T10:00:00.000Z' },
    ],
    links: {
      active_items: [
        {
          id: 'link-1',
          status: 'active',
          stimulus: 'Критика',
          reaction: 'Защищаться',
          old_belief: 'Меня обесценивают',
          new_belief: 'Можно уточнить факт',
          new_actions: 'Спросить, что конкретно не так',
          created_at: '2026-04-08T10:00:00.000Z',
        },
        {
          id: 'link-2',
          status: 'active',
          stimulus: 'Молчание',
          reaction: 'Тревожиться',
          old_belief: 'Меня бросили',
          new_belief: 'Человек может быть занят',
          new_actions: 'Проверить факт через вопрос',
          created_at: '2026-04-09T10:00:00.000Z',
        },
      ],
      inactive_items: [],
    },
    linksReport: {
      links: [
        { id: 'link-1', title: 'Можно уточнить факт', progress_events: 7 },
      ],
      weeks: [],
    },
  }, { todayYmd: '2026-04-10' });

  assert.equal(viewModel.focus.id, 'link-1');
  assert.equal(viewModel.focus.title, 'Можно уточнить факт');
  assert.equal(viewModel.focus.confirmations, 7);
});

test('buildProgressSegments normalizes skewed values to 100 with visible nonzero segments', () => {
  const segments = buildProgressSegments({
    diaries: { value: 1000 },
    successes: { value: 1 },
    signals: { value: 1 },
    newLinks: { value: 1 },
    razbor: { value: 1 },
    confirmations: { value: 1 },
  });

  assert.equal(segments.reduce((sum, item) => sum + item.percent, 0), 100);
  assert.ok(segments.every((item) => item.value === 0 || item.percent >= 4));
});

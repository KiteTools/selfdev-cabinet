import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { renderMarkdown } from '../assets/app/core/markdown.js';
import {
  createAuthController,
  getTelegramWidgetErrorMessage,
} from '../assets/app/core/auth.js';
import { resolveConsultEditorBotButtonMeta } from '../assets/app/features/consultation-editor.js';
import { buildRetroInput } from '../netlify/functions/lib/phase4.js';

test('renderMarkdown formats inline bold text instead of showing asterisks', () => {
  const html = renderMarkdown([
    'Главный вывод: **можно выдержать факт**.',
    '',
    '- **Первый успех**',
  ].join('\n'));

  assert.match(html, /<strong>можно выдержать факт<\/strong>/);
  assert.match(html, /<li><strong>Первый успех<\/strong><\/li>/);
  assert.doesNotMatch(html, /\*\*можно выдержать факт\*\*/);
});

test('buildRetroInput excludes consultation summaries and keeps applied-period signals', () => {
  const retro = buildRetroInput({
    dateFrom: '2026-04-01',
    dateTo: '2026-04-07',
    diaries: [
      {
        id: 'diary-1',
        local_date: '2026-04-02',
        created_at: '2026-04-02T10:00:00.000Z',
        source: 'sendpulse_success',
        text: 'Получилось не убегать из разговора.',
      },
    ],
    consultations: [
      {
        id: 'consult-1',
        created_at: '2026-04-03T10:00:00.000Z',
        summary_json: {
          request: 'Старый запрос',
          false_beliefs: ['Нельзя ошибаться'],
          new_understandings: ['Можно выдержать факт'],
          links: [],
        },
      },
    ],
    razborSessions: [],
    newLinks: [],
    progressEvents: [],
    crmEvents: [
      {
        id: 'crm-1',
        event_type: 'evening_plus',
        value_text: 'Нажал кнопку про выдерживание факта.',
        value_number: null,
        payload: { button: 'plus' },
        occurred_at: '2026-04-02T20:00:00.000Z',
      },
    ],
  });

  assert.doesNotMatch(retro.input, /КОНСУЛЬТАЦИИ:/);
  assert.doesNotMatch(retro.input, /Нельзя ошибаться|Можно выдержать факт/);
  assert.equal('consultations' in retro.input_summary.counts, false);
  assert.match(retro.input, /entry_kind: success/);
  assert.match(retro.input, /event_type: evening_plus/);
});

test('getTelegramWidgetErrorMessage maps bot domain invalid to an actionable message', () => {
  const message = getTelegramWidgetErrorMessage('Bot domain invalid', 'cabinet.example.invalid');

  assert.match(message, /cabinet\.example\.invalid/);
  assert.match(message, /setdomain/i);
});

test('authenticate rejects with explicit telegram domain error instead of hanging', async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousMutationObserver = globalThis.MutationObserver;

  const widget = {
    innerHTML: '',
    textContent: '',
    appendChild(node) {
      this.lastChild = node;
      this.textContent = 'Bot domain invalid';
      this._observer?.();
    },
  };

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe(target) {
      target._observer = this.callback;
    }

    disconnect() {}
  }

  let spContactId = '';
  globalThis.window = {
    location: { search: '?sp_contact_id=contact-1', host: 'cabinet.example.invalid' },
    Telegram: null,
  };
  globalThis.document = {
    createElement() {
      return {
        setAttribute(name, value) {
          this[name] = value;
        },
      };
    },
  };
  globalThis.MutationObserver = FakeMutationObserver;

  try {
    const controller = createAuthController({
      api: async (path) => {
        if (path === 'me') throw new Error('no session');
        if (path === 'config') return { telegram_bot_username: 'example_test_bot' };
        throw new Error(`Unexpected api call: ${path}`);
      },
      getSpContactId: () => spContactId,
      selectLoginWidget: () => widget,
      selectRetryButton: () => null,
      selectStartMessage: () => ({ textContent: '' }),
      setSpContactId: (value) => {
        spContactId = value;
      },
      showScreen: () => {},
    });

    await assert.rejects(controller.authenticate(), /cabinet\.example\.invalid|setdomain/i);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.MutationObserver = previousMutationObserver;
  }
});

test('consultation editor uses shorter bot labels for narrow rows', () => {
  assert.deepEqual(resolveConsultEditorBotButtonMeta('section', 5), {
    label: 'Все вместо цитат',
    title: 'Заполнить цитаты новыми пониманиями по порядку',
  });
  assert.deepEqual(resolveConsultEditorBotButtonMeta('item', 5), {
    label: 'Вместо цитаты',
    title: 'Записать это новое понимание в цитату с тем же номером',
  });
});

test('consultation editor tightens mobile action-button styles', () => {
  const css = fs.readFileSync(new URL('../assets/styles.css', import.meta.url), 'utf8');

  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.consul-editor-bot/);
  assert.match(css, /max-width:\s*112px/);
});

test('consultation editor bot buttons expose readable in-place API states', () => {
  const editorJs = fs.readFileSync(new URL('../assets/app/features/consultation-editor.js', import.meta.url), 'utf8');

  assert.match(editorJs, /button\.textContent = 'Отправляю\.\.\.'/);
  assert.match(editorJs, /button\.textContent = 'Отправлено'/);
  assert.match(editorJs, /button\.textContent = 'Ошибка'/);
  assert.match(editorJs, /await waitForConsultEditorButtonRestore\(/);
});

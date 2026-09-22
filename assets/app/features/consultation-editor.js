import { $ } from '../core/dom.js';

export function resolveConsultEditorBotButtonMeta(kind, sectionNumber) {
  if (kind === 'section') {
    if (sectionNumber === 5) {
      return {
        label: 'Все вместо цитат',
        title: 'Заполнить цитаты новыми пониманиями по порядку',
      };
    }
    if (sectionNumber === 6 || sectionNumber === 7) {
      return {
        label: 'Весь раздел',
        title: 'Отправить весь раздел в переменные Личного кабинета и подключённого бота',
      };
    }
  }

  if (sectionNumber === 5) {
    return {
      label: 'Вместо цитаты',
      title: 'Записать это новое понимание в цитату с тем же номером',
    };
  }

  return {
    label: 'В бот',
    title: 'Отправить этот пункт в переменные Личного кабинета и подключённого бота',
  };
}

export function createConsultationEditorController({
  api,
  loadVersions,
  populateFields,
  setCurrentState,
  setStatus,
}) {
  let consultationEditorOriginal = '';
  let consultationEditorState = null;
  let activeSummaryMarkdown = '';

  function parseSummaryLineToItem(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const markerMatch = trimmed.match(/^[-*•]/);
      return {
        type: 'bullet',
        marker: markerMatch ? markerMatch[0] : '-',
        text: bulletMatch[1].trim(),
      };
    }
    return { type: 'line', text: trimmed };
  }

  function parseSummaryForEditor(summary) {
    const lines = String(summary || '').split(/\r?\n/);
    const preamble = [];
    const sections = [];
    let current = null;

    const pushCurrent = () => {
      if (!current) return;
      sections.push(current);
      current = null;
    };

    for (const line of lines) {
      const trimmed = line.trim();
      const sectionMatch =
        trimmed.match(/^(\d+)[.)]\s+(.*)$/) ||
        trimmed.match(/^\((\d+)\)\s+(.*)$/);
      if (sectionMatch) {
        pushCurrent();
        current = {
          title: `${sectionMatch[1]}) ${sectionMatch[2]}`,
          items: [],
        };
        continue;
      }

      if (!current) {
        if (trimmed) preamble.push(trimmed);
        continue;
      }

      const item = parseSummaryLineToItem(line);
      if (item) current.items.push(item);
    }

    pushCurrent();

    if (sections.length === 0 && preamble.length) {
      const items = preamble.map((line) => parseSummaryLineToItem(line)).filter(Boolean);
      return {
        preamble: [],
        sections: [{ title: '', items, displayTitle: 'Саммари' }],
      };
    }

    return { preamble, sections };
  }

  function buildEditedSummary(editorState) {
    if (!editorState) return '';
    const blocks = [];

    if (editorState.preamble?.length) {
      blocks.push(editorState.preamble.join('\n').trim());
    }

    for (const section of editorState.sections) {
      const sectionLines = [];
      if (section.title) {
        sectionLines.push(section.title);
      }
      for (const item of section.items) {
        if (item.type === 'bullet') {
          sectionLines.push(`${item.marker || '-'} ${item.text}`);
        } else {
          sectionLines.push(item.text);
        }
      }
      if (sectionLines.length) {
        blocks.push(sectionLines.join('\n'));
      }
    }

    return blocks
      .filter((block) => block.trim())
      .join('\n\n')
      .trim();
  }

  function getConsultEditorSectionNumber(section) {
    const title = String(section?.title || '').trim();
    const match = title.match(/^(\d+)[.)]/);
    return match ? Number(match[1]) : null;
  }

  function getConsultEditorSectionItems(section) {
    if (!Array.isArray(section?.items)) return [];
    return section.items
      .map((item) => String(item?.text || '').trim())
      .filter(Boolean);
  }

  function buildConsultEditorSectionText(section) {
    return getConsultEditorSectionItems(section).join('\n').trim();
  }

  function buildConsultEditorSlotChanges(section, fieldPrefix, maxItems, aggregateField = '') {
    const items = getConsultEditorSectionItems(section).slice(0, maxItems);
    const changes = {};

    for (let i = 0; i < maxItems; i++) {
      changes[`${fieldPrefix}${i + 1}`] = items[i] || '';
    }
    if (aggregateField) {
      changes[aggregateField] = items.join('\n');
    }

    return changes;
  }

  function getConsultEditorQuestionChange(text) {
    const source = String(text || '').trim();
    if (!source) return null;

    const morningMatch = source.match(/^Утро:\s*(.*)$/i);
    if (morningMatch) {
      return { q_morning: morningMatch[1].trim() };
    }

    const eveningMatch = source.match(/^Вечер:\s*(.*)$/i);
    if (eveningMatch) {
      return { q_evening: eveningMatch[1].trim() };
    }

    return null;
  }

  function normalizeConsultEditorLinkText(text) {
    return String(text || '')
      .trim()
      .replace(/^Связка\s+\d+:\s*/i, '')
      .trim();
  }

  function getConsultEditorBotPayload({
    sectionIndex,
    itemIndex,
    preambleIndex,
  }) {
    if (!consultationEditorState || Number.isFinite(preambleIndex)) return null;

    const section = consultationEditorState.sections[sectionIndex];
    if (!section) return null;

    const sectionNumber = getConsultEditorSectionNumber(section);
    const sectionText = buildConsultEditorSectionText(section);
    const hasItem = Number.isFinite(itemIndex);
    const item = hasItem ? section.items[itemIndex] : null;
    const itemText = String(item?.text || '').trim();

    switch (sectionNumber) {
      case 1:
        return (hasItem ? itemText : sectionText)
          ? { changes: { gpt_zapros: hasItem ? itemText : sectionText } }
          : null;

      case 5:
        if (hasItem) {
          if (!itemText || itemIndex >= 10) return null;
          return { changes: { [`q${itemIndex + 1}`]: itemText } };
        }
        return { changes: buildConsultEditorSlotChanges(section, 'q', 10, 'gpt_quotes') };

      case 6:
        if (hasItem) {
          if (!itemText || itemIndex >= 10) return null;
          return { changes: { [`aff${itemIndex + 1}`]: itemText } };
        }
        return { changes: buildConsultEditorSlotChanges(section, 'aff', 10, 'gpt_affirmation') };

      case 7:
        if (hasItem) {
          if (!itemText || itemIndex >= 10) return null;
          return { changes: { [`q${itemIndex + 1}`]: itemText } };
        }
        return { changes: buildConsultEditorSlotChanges(section, 'q', 10, 'gpt_quotes') };

      case 8:
        if (hasItem) {
          const itemChanges = getConsultEditorQuestionChange(itemText);
          return itemChanges ? { changes: itemChanges } : null;
        }
        if (!sectionText) return null;
        return {
          changes: getConsultEditorSectionItems(section).reduce((acc, line) => {
            const next = getConsultEditorQuestionChange(line);
            if (next) Object.assign(acc, next);
            return acc;
          }, { q_morning: '', q_evening: '' }),
        };

      case 9:
        if (hasItem) {
          const linkText = normalizeConsultEditorLinkText(itemText);
          if (!linkText) return null;
          if (itemIndex === 0) {
            return { changes: { link_main: linkText, gpt_situation: linkText } };
          }
          if (itemIndex === 1) {
            return { changes: { link_add: linkText } };
          }
          return null;
        }

        if (!sectionText) return null;
        {
          const links = getConsultEditorSectionItems(section)
            .map(normalizeConsultEditorLinkText)
            .filter(Boolean)
            .slice(0, 2);
          return {
            changes: {
              link_main: links[0] || '',
              link_add: links[1] || '',
              gpt_situation: links[0] || '',
            },
          };
        }

      case 10:
        return (hasItem ? itemText : sectionText)
          ? { changes: { gpt_talants: hasItem ? itemText : sectionText } }
          : null;

      case 11:
        return (hasItem ? itemText : sectionText)
          ? { changes: { gpt_grabli: hasItem ? itemText : sectionText } }
          : null;

      case 12:
        return (hasItem ? itemText : sectionText)
          ? { changes: { gpt_motiv: hasItem ? itemText : sectionText } }
          : null;

      case 13:
        return (hasItem ? itemText : sectionText)
          ? { changes: { gpt_mycontext: hasItem ? itemText : sectionText } }
          : null;

      default:
        return null;
    }
  }

  function shouldRenderConsultEditorBotButton({
    kind,
    sectionIndex,
    itemIndex,
    preambleIndex,
  }) {
    const payload = getConsultEditorBotPayload({ sectionIndex, itemIndex, preambleIndex });
    if (!payload) return false;

    if (kind !== 'section') return true;

    const section = consultationEditorState?.sections?.[sectionIndex];
    const sectionNumber = getConsultEditorSectionNumber(section);
    return sectionNumber === 5 || sectionNumber === 6 || sectionNumber === 7;
  }

  function getConsultEditorBotButtonMeta({
    kind,
    sectionIndex,
  }) {
    const section = consultationEditorState?.sections?.[sectionIndex];
    const sectionNumber = getConsultEditorSectionNumber(section);
    return resolveConsultEditorBotButtonMeta(kind, sectionNumber);
  }

  function createConsultEditorRow({
    text,
    kind,
    sectionIndex,
    itemIndex,
    preambleIndex,
    action,
  }) {
    const row = document.createElement('div');
    row.className = `consul-editor-row ${kind}`;

    const textEl = document.createElement('div');
    textEl.className = 'consul-editor-text';
    textEl.textContent = text;

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'consul-editor-remove';
    removeButton.textContent = 'x';
    removeButton.dataset.action = action || (kind === 'section' ? 'remove-section' : 'remove-item');
    if (typeof sectionIndex === 'number') removeButton.dataset.sectionIndex = String(sectionIndex);
    if (typeof itemIndex === 'number') removeButton.dataset.itemIndex = String(itemIndex);
    if (typeof preambleIndex === 'number') removeButton.dataset.preambleIndex = String(preambleIndex);

    const botButton = document.createElement('button');
    botButton.type = 'button';
    botButton.className = 'consul-editor-bot';
    botButton.dataset.action = 'send-to-bot';
    if (typeof sectionIndex === 'number') botButton.dataset.sectionIndex = String(sectionIndex);
    if (typeof itemIndex === 'number') botButton.dataset.itemIndex = String(itemIndex);
    if (typeof preambleIndex === 'number') botButton.dataset.preambleIndex = String(preambleIndex);

    const shouldRenderBotButton = shouldRenderConsultEditorBotButton({
      kind,
      sectionIndex,
      itemIndex,
      preambleIndex,
    });
    if (shouldRenderBotButton) {
      const botMeta = getConsultEditorBotButtonMeta({ kind, sectionIndex });
      botButton.textContent = botMeta.label;
      botButton.title = botMeta.title;
    }

    const actionsEl = document.createElement('div');
    actionsEl.className = 'consul-editor-actions';
    if (shouldRenderBotButton) {
      actionsEl.append(botButton);
    }
    actionsEl.append(removeButton);

    row.append(textEl, actionsEl);
    return row;
  }

  function renderConsultationEditor() {
    const container = $('#consul-editor-list');
    if (!container) return;
    container.innerHTML = '';

    if (!consultationEditorState || consultationEditorState.sections.length === 0) {
      container.innerHTML = '<div class="consul-editor-empty">Нет разделов для редактирования.</div>';
      return;
    }

    if (consultationEditorState.preamble?.length) {
      consultationEditorState.preamble.forEach((line, preambleIndex) => {
        container.appendChild(createConsultEditorRow({
          text: line,
          kind: 'item',
          preambleIndex,
          action: 'remove-preamble',
        }));
      });
    }

    consultationEditorState.sections.forEach((section, sectionIndex) => {
      const titleText = section.title || section.displayTitle || 'Саммари';
      container.appendChild(createConsultEditorRow({
        text: titleText,
        kind: 'section',
        sectionIndex,
      }));

      section.items.forEach((item, itemIndex) => {
        const prefix = item.type === 'bullet' ? `${item.marker || '-'} ` : '';
        container.appendChild(createConsultEditorRow({
          text: `${prefix}${item.text}`,
          kind: 'item',
          sectionIndex,
          itemIndex,
        }));
      });
    });
  }

  function waitForConsultEditorButtonRestore(delayMs = 900) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, delayMs);
    });
  }

  async function sendConsultEditorToBot(button) {
    const sectionIndex = button.dataset.sectionIndex === undefined
      ? null
      : Number(button.dataset.sectionIndex);
    const itemIndex = button.dataset.itemIndex === undefined
      ? null
      : Number(button.dataset.itemIndex);
    const preambleIndex = button.dataset.preambleIndex === undefined
      ? null
      : Number(button.dataset.preambleIndex);

    const payload = getConsultEditorBotPayload({ sectionIndex, itemIndex, preambleIndex });
    const changes = payload?.changes || null;
    if (!changes || Object.keys(changes).length === 0) return;

    const originalText = button.textContent;
    let restoreDelayMs = 0;
    button.disabled = true;
    button.textContent = 'Отправляю...';
    setStatus('Сохраняю...', 'saving');

    try {
      const result = await api('state-patch', {
        method: 'PATCH',
        body: JSON.stringify({ changes }),
      });

      if (result.data) {
        setCurrentState(result.data);
        populateFields(result.data);
      }

      await loadVersions();
      if (result.delivery?.delivered) {
        setStatus('Переменные бота обновлены', 'saved');
        button.textContent = 'Отправлено';
      } else {
        setStatus('Сохранено в Личном кабинете; доставка в бот отключена', 'saved');
        button.textContent = 'Сохранено';
      }
      restoreDelayMs = 900;
    } catch (err) {
      console.error('consult editor send-to-bot error', err);
      setStatus(err.data?.error || 'Не удалось отправить в бот', 'error');
      button.textContent = 'Ошибка';
      restoreDelayMs = 1200;
    } finally {
      if (restoreDelayMs > 0) {
        await waitForConsultEditorButtonRestore(restoreDelayMs);
      }
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function handleConsultEditorClick(event) {
    const button = event.target.closest('button');
    if (!button || !button.dataset.action || !consultationEditorState) return;

    if (button.dataset.action === 'send-to-bot') {
      await sendConsultEditorToBot(button);
      return;
    }

    if (button.dataset.action === 'remove-preamble') {
      const preambleIndex = Number(button.dataset.preambleIndex);
      if (!Number.isFinite(preambleIndex) || !consultationEditorState.preamble) return;
      consultationEditorState.preamble.splice(preambleIndex, 1);
      renderConsultationEditor();
      return;
    }

    const sectionIndex = Number(button.dataset.sectionIndex);
    if (!Number.isFinite(sectionIndex)) return;

    if (button.dataset.action === 'remove-section') {
      consultationEditorState.sections.splice(sectionIndex, 1);
      renderConsultationEditor();
      return;
    }

    if (button.dataset.action === 'remove-item') {
      const itemIndex = Number(button.dataset.itemIndex);
      if (!Number.isFinite(itemIndex)) return;
      const section = consultationEditorState.sections[sectionIndex];
      if (!section) return;
      section.items.splice(itemIndex, 1);
      renderConsultationEditor();
    }
  }

  function loadSummary(summaryMarkdown) {
    activeSummaryMarkdown = summaryMarkdown || '';
    consultationEditorOriginal = activeSummaryMarkdown;
    consultationEditorState = parseSummaryForEditor(activeSummaryMarkdown);
    renderConsultationEditor();
  }

  function resetConsultationEditor() {
    consultationEditorState = parseSummaryForEditor(consultationEditorOriginal || '');
    renderConsultationEditor();
  }

  function getEditedSummaryText() {
    return buildEditedSummary(consultationEditorState) || activeSummaryMarkdown || '';
  }

  return {
    getEditedSummaryText,
    handleConsultEditorClick,
    loadSummary,
    renderConsultationEditor,
    resetConsultationEditor,
  };
}

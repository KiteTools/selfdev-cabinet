import Busboy from 'busboy';
import nodemailer from 'nodemailer';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const SUMMARY_JSON_SCHEMA = {
  name: 'consultation_summary',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      request: { type: 'string' },
      material_consequences: {
        type: 'array',
        items: { type: 'string' },
      },
      emotional_consequences: {
        type: 'array',
        items: { type: 'string' },
      },
      false_beliefs: {
        type: 'array',
        items: { type: 'string' },
      },
      new_understandings: {
        type: 'array',
        items: { type: 'string' },
      },
      affirmations: {
        type: 'array',
        items: { type: 'string' },
      },
      quotes: {
        type: 'array',
        items: { type: 'string' },
      },
      questions_morning: { type: 'string' },
      questions_evening: { type: 'string' },
      links: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            stimulus: { type: 'string' },
            reaction: { type: 'string' },
            old_belief: { type: 'string' },
            new_belief: { type: 'string' },
            new_actions: { type: 'string' },
          },
          required: ['stimulus', 'reaction', 'old_belief', 'new_belief', 'new_actions'],
        },
      },
      talents: {
        type: 'array',
        items: { type: 'string' },
      },
      destructive_patterns: {
        type: 'array',
        items: { type: 'string' },
      },
      motivations: {
        type: 'array',
        items: { type: 'string' },
      },
      context: { type: 'string' },
      genealogy: { type: 'string' },
    },
    required: [
      'request',
      'material_consequences',
      'emotional_consequences',
      'false_beliefs',
      'new_understandings',
      'affirmations',
      'quotes',
      'questions_morning',
      'questions_evening',
      'links',
      'talents',
      'destructive_patterns',
      'motivations',
      'context',
      'genealogy',
    ],
  },
};

const POSTER_PROMPTS_JSON_SCHEMA = {
  type: 'json_schema',
  name: 'poster_prompts',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      prompts: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
    },
    required: ['prompts'],
  },
};

export const SUMMARY_TEMPLATES = {
  one_on_one: {
    label: '1:1 глубокий разбор',
    instructions: [
      'Это транскрипт консультации на русском языке.',
      'Сначала определи, кто в репликах клиент, а кто консультант.',
      'Работай по внутреннему алгоритму (его в ответ не выводи):',
      '1) Из реплик клиента выдели исходный запрос, признаки неудовлетворительного результата, материальные и эмоциональные последствия.',
      '2) Выдели ложные понимания клиента из двух источников:',
      '   а) Явные: что клиент прямо говорит как свою модель или задаёт как вопрос.',
      '   б) Из коррекций консультанта: когда консультант говорит «это не то, когда…», противопоставляет, переформулирует или опровергает — за этим стоит ложное понимание клиента, даже если клиент его не озвучивал. Извлеки его.',
      '   Особое внимание к формулам «это не X, а Y» в речи консультанта: X = ложное понимание (даже если клиент его явно не произносил), Y = новое понимание. Оба должны быть зафиксированы.',
      '3) Выдели новые понимания двух типов:',
      '   а) Факты: что является чем, что за чем стоит.',
      '   б) Механизмы: как устроен процесс, чем одно отличается от другого, что является критерием, какие есть условия. Если консультант объясняет различие, описывает процесс или даёт критерий — это механизм.',
      '   Механизмов должно быть не меньше, чем фактов.',
      '   Если консультант разбирает конкретный библейский эпизод, житейскую аналогию или пример из жизни клиента — извлеки принцип (механизм), который стоит за примером, и включи его в новые понимания. Пример — это не иллюстрация, а часто единственный способ, которым консультант передаёт механизм.',
      '4) Внутренне сопоставь: какие новые понимания закрывают какие ложные (1-ко-многим допустимо).',
      '5) Отметь бэклог: ложные понимания, на которые консультант не дал нового понимания.',
      '6) Сформулируй 10 аффирмаций от первого лица, в настоящем времени.',
      '   Каждое новое понимание (факт и механизм) должно быть покрыто хотя бы одной аффирмацией.',
      '   Аффирмации должны содержать конкретику сессии, а не общие духовные формулы.',
      '   Используй язык и образы консультанта там, где они яркие и запоминающиеся.',
      '   Баланс: не более трёх аффирмаций типа «Я замечаю / Я вижу» — остальные должны содержать действие, выбор или конкретный принцип.',
      '7) Выдели 10 ключевых цитат консультанта без перефразирования.',
      '   Приоритет отбора:',
      '   1-й — цитаты с противопоставлением: «это не X, а Y» (механизм, критерий, различие).',
      '   2-й — цитаты с яркой метафорой или образом, передающим ключевое новое понимание.',
      '   3-й — цитаты, фиксирующие итоговый вывод или факт сессии.',
      '   НЕ бери организационные реплики, комплименты, шутки и реплики-связки.',
      '   Не более двух цитат из одного смыслового блока.',
      '8) Сформулируй один вопрос на утро и один на вечер во втором лице, как от консультанта.',
      '9) Построй 1-2 связки (стимул → реакция → старое понимание → новое понимание → новые действия). Каждая связка привязана к отдельной ключевой линии сессии. Если в сессии есть 2 различимые линии разбора — сделай 2 связки.',
      '10) Выдели таланты клиента, повторяющиеся неконструктивные паттерны и мотивации — с опорой на цитаты/смысл транскрипта.',
      '11) Выдели текущий контекст клиента: чем занимается, из какого состояния в какое идёт, задачи, обучение, география.',
      '12) Выдели факты про предков и детей: паттерны, убеждения, частые фразы.',
      'ПРОВЕРКА ПОЛНОТЫ (выполни после формирования всех разделов):',
      'Пройди по всем развёрнутым высказываниям консультанта (3+ предложений подряд). Для каждого такого блока проверь:',
      'а) Есть ли в нём противопоставление («это не X, а Y», «не потому что X, а потому что Y», «в тактике одно, в стратегии другое») — если да, X должен быть в ложных пониманиях, Y в новых пониманиях, а сама формулировка — кандидат в цитаты первого приоритета.',
      'б) Есть ли конкретный пример или аналогия (библейский персонаж, житейская ситуация, метафора) — если да, проверь, покрыт ли принцип за примером в новых пониманиях.',
      'в) Есть ли смена модели клиента (клиент говорил X, консультант скорректировал на Y) — если да, X должен быть в ложных пониманиях, Y в новых.',
      'г) Проверь, что каждое новое понимание (и факт, и механизм) отражено хотя бы в одной аффирмации. Если нет — добавь или переформулируй.',
      'Если суть блока не отражена ни в одном разделе — это пропуск. Добавь недостающее.',
      'Заполни поля строго по схеме:',
      'request: строка с исходным запросом клиента.',
      'material_consequences: массив материальных последствий.',
      'emotional_consequences: массив эмоциональных последствий.',
      'false_beliefs: массив ложных пониманий/убеждений.',
      'new_understandings: массив новых пониманий.',
      'affirmations: массив ровно из 10 строк.',
      'quotes: массив ровно из 10 строк (цитаты консультанта без перефразирования).',
      'questions_morning: строка.',
      'questions_evening: строка.',
      'links: массив из 1-2 объектов; каждый объект с полями stimulus, reaction, old_belief, new_belief, new_actions; каждое поле не длиннее ~980 символов.',
      'talents: массив талантов клиента.',
      'destructive_patterns: массив повторяющихся неконструктивных паттернов.',
      'motivations: массив мотиваций/движущих сил.',
      'context: строка с текущим контекстом.',
      'genealogy: строка о предках/детях, генограмма в свободной форме.',
      'Если данных мало, заполняй поля безопасно и кратко, но не пропускай обязательные поля.',
      'Запрещено: markdown, комментарии, пояснения, нумерация разделов, текст вне JSON.',
      'Верни только один JSON-объект, строго соответствующий схеме (strict JSON).',
    ].join('\n'),
  },
  topics: {
    label: '1:1 упрощенный',
    instructions: [
      'Это транскрипт консультации на русском языке.',
      'Определи роли клиента и консультанта.',
      'Сделай упрощенный, прикладной и более короткий вариант, но верни все поля схемы.',
      'Используй внутренний алгоритм (в ответ не выводи):',
      '1) Извлеки исходный запрос, материальные и эмоциональные последствия, ложные понимания, новые понимания.',
      '2) Внутренне сопоставь новые понимания с ложными пониманиями.',
      '3) Сформулируй аффирмации (ровно 10) и цитаты консультанта (ровно 10, без перефразирования).',
      '4) Сформулируй один вопрос на утро и один вопрос на вечер.',
      '5) Сформируй 1-2 связки: stimulus/reaction/old_belief/new_belief/new_actions.',
      '6) Кратко заполни talents, destructive_patterns, motivations, context, genealogy.',
      'Требования к полям:',
      'affirmations: ровно 10 строк, от первого лица, в настоящем времени.',
      'quotes: ровно 10 строк, дословные цитаты консультанта.',
      'links: 1-2 объекта; каждое текстовое поле до ~980 символов.',
      'Остальные массивы делай компактными и прикладными (обычно 3-7 пунктов), без потери смысла.',
      'Если данных недостаточно, используй краткие нейтральные формулировки, не пропускай обязательные поля.',
      'Запрещено: markdown, комментарии, пояснения, любой текст вне JSON.',
      'Верни только один JSON-объект, строго соответствующий схеме (strict JSON).',
    ].join('\n'),
  },
  diary_period: {
    label: 'Дневники за период',
    instructions: [
      'Это набор дневниковых записей клиента за период на русском языке.',
      'Проанализируй динамику клиента за период и сформируй итоговое summary.',
      'Начиная с этого пункта соблюдай формат ответа: каждый подраздел отдельным заголовком, под ним список с дефисами.',
      'Подраздел 1: Успехи клиента.',
      'Подраздел 2: Негативные реакции.',
      'Подраздел 3: Новые понимания.',
      'Подраздел 4: Новые идеи.',
      'Каждый подраздел должен содержать минимум 3 пункта, если данных хватает.',
      'Если данных недостаточно, дай максимально конкретные пункты по имеющимся записям, не добавляй вымышленные факты.',
      'Пиши только на русском языке.',
      'Не используй JSON.',
      'Не добавляй комментарии вне итогового summary.',
    ].join('\n'),
  },
};

export const NOTES_SUMMARY_INSTRUCTIONS = [
  'Улучши все подразделы саммари в соответствии с моим конспектом ниже.',
  'Учитывай, что я конспектировал слова консультанта.',
  'Текст в одинарных апострофах (‘текст’) особенно важен и должен максимально задействоваться в подходящих подразделах.',
].join('\n');

export const SUMMARY_APPLY_GROUPS = [
  {
    id: 'affirmations',
    label: 'Аффирмации',
    fields: Array.from({ length: 10 }, (_, i) => `aff${i + 1}`),
  },
  {
    id: 'quotes',
    label: 'Цитаты',
    fields: Array.from({ length: 10 }, (_, i) => `q${i + 1}`),
  },
  {
    id: 'questions',
    label: 'Вопросы',
    fields: ['q_morning', 'q_evening'],
  },
  {
    id: 'links',
    label: 'Связки',
    fields: ['link_main', 'link_add', 'gpt_situation'],
  },
  {
    id: 'gpt',
    label: 'GPT блок',
    fields: [
      'gpt_zapros',
      'gpt_talants',
      'gpt_grabli',
      'gpt_motiv',
      'gpt_mycontext',
      'gpt_affirmation',
      'gpt_quotes',
    ],
  },
];

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_MODEL = 'gpt-5.4';
const DEFAULT_REASONING_EFFORT = 'high';
const MAX_OPENAI_REQUEST_MS = 600000;

function resolveReasoningEffort() {
  const effort = String(process.env.OPENAI_REASONING_EFFORT || DEFAULT_REASONING_EFFORT)
    .trim()
    .toLowerCase();
  const allowed = new Set(['minimal', 'low', 'medium', 'high', 'xhigh']);
  return allowed.has(effort) ? effort : DEFAULT_REASONING_EFFORT;
}

function getTemplate(summaryType) {
  return SUMMARY_TEMPLATES[summaryType] || SUMMARY_TEMPLATES.one_on_one;
}

function clampString(value, maxLength = 1000) {
  const str = String(value ?? '').trim();
  if (!str) return '';
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

function normalizeArray(value, { maxItems = 20, itemMaxLength = 1000 } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => clampString(item, itemMaxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeFixedArray(value, size, itemMaxLength = 1000) {
  const arr = normalizeArray(value, { maxItems: size, itemMaxLength });
  while (arr.length < size) arr.push('');
  return arr.slice(0, size);
}

function normalizeLinks(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 2).map((item) => ({
    stimulus: clampString(item?.stimulus, 980),
    reaction: clampString(item?.reaction, 980),
    old_belief: clampString(item?.old_belief, 980),
    new_belief: clampString(item?.new_belief, 980),
    new_actions: clampString(item?.new_actions, 980),
  }));
}

export function normalizeSummary(summary) {
  const src = summary && typeof summary === 'object' ? summary : {};

  return {
    request: clampString(src.request, 5000),
    material_consequences: normalizeArray(src.material_consequences, { maxItems: 20, itemMaxLength: 1000 }),
    emotional_consequences: normalizeArray(src.emotional_consequences, { maxItems: 20, itemMaxLength: 1000 }),
    false_beliefs: normalizeArray(src.false_beliefs, { maxItems: 20, itemMaxLength: 1000 }),
    new_understandings: normalizeArray(src.new_understandings, { maxItems: 20, itemMaxLength: 1000 }),
    affirmations: normalizeFixedArray(src.affirmations, 10, 1000),
    quotes: normalizeFixedArray(src.quotes, 10, 1000),
    questions_morning: clampString(src.questions_morning, 1000),
    questions_evening: clampString(src.questions_evening, 1000),
    links: normalizeLinks(src.links),
    talents: normalizeArray(src.talents, { maxItems: 20, itemMaxLength: 1000 }),
    destructive_patterns: normalizeArray(src.destructive_patterns, { maxItems: 20, itemMaxLength: 1000 }),
    motivations: normalizeArray(src.motivations, { maxItems: 20, itemMaxLength: 1000 }),
    context: clampString(src.context, 5000),
    genealogy: clampString(src.genealogy, 5000),
  };
}

export function normalizeText(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function parseVtt(text) {
  const lines = normalizeText(text).split('\n');
  const output = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === 'WEBVTT') continue;
    if (/^NOTE/.test(trimmed)) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s-->/.test(trimmed)) continue;
    if (/^\d{2}:\d{2}\.\d{3}\s-->/.test(trimmed)) continue;
    output.push(trimmed);
  }

  return output.join('\n');
}

export function truncateText(text, headChars, tailChars) {
  const source = String(text || '');
  if (!source) return { text: '', truncated: false };
  if (source.length <= headChars + tailChars) {
    return { text: source, truncated: false };
  }

  const head = source.slice(0, headChars);
  const tail = source.slice(-tailChars);
  return {
    text: `${head}\n\n[...truncated...]\n\n${tail}`,
    truncated: true,
  };
}

export function resolveTruncationLimit(value, fallback, maxAllowed = fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maxAllowed);
}

export async function parseMultipartForm(event) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const files = {};
    let fileTooLarge = false;

    const busboy = Busboy({ headers: event.headers || {} });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (name, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      let size = 0;

      file.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_FILE_BYTES) {
          fileTooLarge = true;
          file.resume();
          return;
        }
        chunks.push(chunk);
      });

      file.on('end', () => {
        if (fileTooLarge) return;
        files[name] = {
          filename,
          mimeType,
          size,
          buffer: Buffer.concat(chunks),
        };
      });
    });

    busboy.on('finish', () => {
      if (fileTooLarge) {
        const error = new Error('File too large');
        error.code = 'FILE_TOO_LARGE';
        reject(error);
        return;
      }
      resolve({ fields, files });
    });

    busboy.on('error', reject);

    const body = Buffer.from(
      event.body || '',
      event.isBase64Encoded ? 'base64' : 'utf8'
    );
    busboy.end(body);
  });
}

export function extractTextFromFile(file) {
  const ext = String(file?.filename || '').split('.').pop().toLowerCase();
  const raw = file?.buffer ? file.buffer.toString('utf8') : '';
  if (ext === 'vtt') return parseVtt(raw);
  return normalizeText(raw);
}

export function buildPromptInput(transcriptText, notesText = '') {
  const blocks = [`Transcript:\n${transcriptText}`];
  if (notesText) blocks.push(`User Notes:\n${notesText}`);
  return blocks.join('\n\n');
}

export function buildSummaryInstructions(summaryType, { hasNotes = false } = {}) {
  const template = getTemplate(summaryType);
  if (!hasNotes) {
    return template.instructions;
  }

  return [
    template.instructions,
    '',
    'Дополнительная инструкция для приложенного конспекта:',
    NOTES_SUMMARY_INSTRUCTIONS,
  ].join('\n');
}

export function extractResponseText(responseJson) {
  if (!responseJson) return '';

  if (typeof responseJson.output_text === 'string') {
    return responseJson.output_text;
  }

  if (!Array.isArray(responseJson.output)) return '';

  for (const output of responseJson.output) {
    if (!output) continue;
    if (typeof output.content === 'string') {
      return output.content;
    }
    if (!Array.isArray(output.content)) continue;

    const textPart = output.content.find(
      (part) => part && (part.type === 'output_text' || part.type === 'text') && part.text
    );
    if (textPart) return textPart.text;

    const fallbackPart = output.content.find(
      (part) => part && typeof part.text === 'string'
    );
    if (fallbackPart) return fallbackPart.text;
  }

  return '';
}

export function extractResponseDiagnostics(responseJson) {
  const info = {
    hasRefusal: false,
    refusalMessage: '',
    outputTypes: [],
    contentTypes: [],
    outputTextLength: 0,
    status: '',
    incompleteReason: '',
  };

  if (!responseJson) return info;

  if (typeof responseJson.status === 'string') {
    info.status = responseJson.status;
  }
  if (responseJson.incomplete_details?.reason) {
    info.incompleteReason = responseJson.incomplete_details.reason;
  }
  if (typeof responseJson.output_text === 'string') {
    info.outputTextLength = responseJson.output_text.length;
  }
  if (!Array.isArray(responseJson.output)) return info;

  for (const output of responseJson.output) {
    if (!output) continue;
    if (output.type) info.outputTypes.push(output.type);
    if (!Array.isArray(output.content)) continue;

    for (const part of output.content) {
      if (!part) continue;
      if (part.type) info.contentTypes.push(part.type);
      if (part.type === 'refusal') {
        info.hasRefusal = true;
        info.refusalMessage = part.refusal || part.text || '';
      }
    }
  }

  return info;
}

function parseJsonObject(text) {
  const direct = text.trim();
  if (!direct) {
    throw new Error('Empty response from OpenAI');
  }

  try {
    return JSON.parse(direct);
  } catch {}

  const first = direct.indexOf('{');
  const last = direct.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const candidate = direct.slice(first, last + 1);
    return JSON.parse(candidate);
  }

  throw new Error('Invalid JSON response from OpenAI');
}

function resolveOpenAiModel(modelEnv) {
  const preferred = String(process.env[modelEnv] || '').trim();
  if (preferred) return preferred;

  if (modelEnv !== 'OPENAI_MODEL') {
    const baseModel = String(process.env.OPENAI_MODEL || '').trim();
    if (baseModel) return baseModel;
  }

  return DEFAULT_OPENAI_MODEL;
}

function supportsReasoningEffort(model) {
  return /^gpt-5(?:[.-]|$)/i.test(String(model || '').trim());
}

async function callOpenAi({
  instructions,
  input,
  format = null,
  modelEnv = 'OPENAI_MODEL',
  maxTokensEnv = 'OPENAI_MAX_OUTPUT_TOKENS',
  timeoutEnv = 'OPENAI_TIMEOUT_MS',
  reasoningEffort = undefined,
  store = false,
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = resolveOpenAiModel(modelEnv);
  const maxOutputTokensRaw = process.env[maxTokensEnv];
  const maxOutputTokens = maxOutputTokensRaw ? Number(maxOutputTokensRaw) : undefined;
  const timeoutMsRaw = process.env[timeoutEnv];
  const configuredTimeoutMs = timeoutMsRaw ? Number(timeoutMsRaw) : 600000;
  const timeoutMs = Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
    ? Math.min(configuredTimeoutMs, MAX_OPENAI_REQUEST_MS)
    : 600000;

  if (!apiKey) throw new Error('OpenAI API key is not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload = {
      model,
      instructions,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: input }],
        },
      ],
      store,
    };

    if (supportsReasoningEffort(model)) {
      const effort = typeof reasoningEffort === 'string' && reasoningEffort.trim()
        ? reasoningEffort.trim().toLowerCase()
        : resolveReasoningEffort();
      payload.reasoning = { effort };
    }

    if (format) {
      payload.text = { format };
    }
    if (Number.isFinite(maxOutputTokens) && maxOutputTokens > 0) {
      payload.max_output_tokens = maxOutputTokens;
    }

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status}${response.status === 401 ? ' invalid_api_key' : ''}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function callOpenAiSummary({ summaryType, input, hasNotes = false }) {
  const instructions = buildSummaryInstructions(summaryType, { hasNotes });
  const useDiaryOverrides = summaryType === 'diary_period';
  const modelEnv = useDiaryOverrides && process.env.OPENAI_DIARY_MODEL
    ? 'OPENAI_DIARY_MODEL'
    : 'OPENAI_MODEL';
  const maxTokensEnv = useDiaryOverrides && process.env.OPENAI_DIARY_MAX_OUTPUT_TOKENS
    ? 'OPENAI_DIARY_MAX_OUTPUT_TOKENS'
    : 'OPENAI_MAX_OUTPUT_TOKENS';
  const timeoutEnv = useDiaryOverrides && process.env.OPENAI_DIARY_TIMEOUT_MS
    ? 'OPENAI_DIARY_TIMEOUT_MS'
    : 'OPENAI_TIMEOUT_MS';
  const format = {
    type: 'json_schema',
    name: SUMMARY_JSON_SCHEMA.name,
    strict: SUMMARY_JSON_SCHEMA.strict,
    schema: SUMMARY_JSON_SCHEMA.schema,
  };
  const data = await callOpenAi({
    instructions,
    input,
    format,
    modelEnv,
    maxTokensEnv,
    timeoutEnv,
  });

  const text = extractResponseText(data);
  if (!text) {
    const diagnostics = extractResponseDiagnostics(data);
    const meta = [
      `status=${diagnostics.status || 'unknown'}`,
      `incomplete=${diagnostics.incompleteReason || 'none'}`,
      `outputTypes=${diagnostics.outputTypes.join(',')}`,
      `contentTypes=${diagnostics.contentTypes.join(',')}`,
      `outputTextLength=${diagnostics.outputTextLength}`,
    ].join(';');
    if (diagnostics.hasRefusal) {
      throw new Error(`OpenAI refusal (${meta})`);
    }
    throw new Error(`Empty response from OpenAI (${meta})`);
  }

  return normalizeSummary(parseJsonObject(text));
}

export async function callOpenAiText({
  instructions,
  input,
  format = null,
  modelEnv = null,
  maxTokensEnv = null,
  timeoutEnv = null,
  reasoningEffort = undefined,
  store = false,
}) {
  const resolvedModelEnv = modelEnv || (process.env.OPENAI_POSTER_MODEL ? 'OPENAI_POSTER_MODEL' : 'OPENAI_MODEL');
  const resolvedMaxTokensEnv = maxTokensEnv || (
    process.env.OPENAI_POSTER_MAX_OUTPUT_TOKENS
      ? 'OPENAI_POSTER_MAX_OUTPUT_TOKENS'
      : 'OPENAI_MAX_OUTPUT_TOKENS'
  );
  const resolvedTimeoutEnv = timeoutEnv || (
    process.env.OPENAI_POSTER_TIMEOUT_MS
      ? 'OPENAI_POSTER_TIMEOUT_MS'
      : 'OPENAI_TIMEOUT_MS'
  );

  const data = await callOpenAi({
    instructions,
    input,
    format,
    modelEnv: resolvedModelEnv,
    maxTokensEnv: resolvedMaxTokensEnv,
    timeoutEnv: resolvedTimeoutEnv,
    reasoningEffort,
    store,
  });

  const text = extractResponseText(data);
  if (!text) {
    const diagnostics = extractResponseDiagnostics(data);
    const meta = [
      `status=${diagnostics.status || 'unknown'}`,
      `incomplete=${diagnostics.incompleteReason || 'none'}`,
      `outputTypes=${diagnostics.outputTypes.join(',')}`,
      `contentTypes=${diagnostics.contentTypes.join(',')}`,
      `outputTextLength=${diagnostics.outputTextLength}`,
    ].join(';');
    if (diagnostics.hasRefusal) {
      throw new Error(`OpenAI refusal (${meta})`);
    }
    throw new Error(`Empty response from OpenAI (${meta})`);
  }

  return text.trim();
}

export async function callOpenAiDiarySummaryText({ input }) {
  const template = getTemplate('diary_period');
  return callOpenAiText({
    instructions: template.instructions,
    input,
    modelEnv: process.env.OPENAI_DIARY_MODEL ? 'OPENAI_DIARY_MODEL' : 'OPENAI_MODEL',
    maxTokensEnv: process.env.OPENAI_DIARY_MAX_OUTPUT_TOKENS
      ? 'OPENAI_DIARY_MAX_OUTPUT_TOKENS'
      : 'OPENAI_MAX_OUTPUT_TOKENS',
    timeoutEnv: process.env.OPENAI_DIARY_TIMEOUT_MS
      ? 'OPENAI_DIARY_TIMEOUT_MS'
      : 'OPENAI_TIMEOUT_MS',
  });
}

export function formatLinkText(link) {
  if (!link) return '';
  const parts = [
    ['СТИМУЛ', link.stimulus],
    ['РЕАКЦИЯ', link.reaction],
    ['СТАРОЕ ПОНИМАНИЕ', link.old_belief],
    ['НОВОЕ ПОНИМАНИЕ', link.new_belief],
    ['НОВЫЕ ДЕЙСТВИЯ', link.new_actions],
  ];

  return parts
    .map(([title, value]) => `${title}: ${clampString(value, 980)}`)
    .join(' ');
}

export function renderSummaryToMarkdown(summaryInput, options = {}) {
  const s = normalizeSummary(summaryInput);
  const summaryType = String(options?.summaryType || 'one_on_one');
  const isSimplified = summaryType === 'topics';
  const quotesTitle = summaryType === 'diary_period'
    ? 'Ключевые цитаты из дневников'
    : 'Цитаты консультанта';
  const lines = [];

  const pushSection = (index, title, items) => {
    lines.push(`${index}) ${title}`);
    if (!items || items.length === 0) {
      lines.push('- —');
      lines.push('');
      return;
    }
    for (const item of items) {
      lines.push(`- ${item || '—'}`);
    }
    lines.push('');
  };

  pushSection(1, 'Исходный запрос', [s.request]);
  pushSection(2, 'Материальные последствия', s.material_consequences);
  pushSection(3, 'Эмоциональные последствия', s.emotional_consequences);
  pushSection(4, 'Ложные понимания', s.false_beliefs);
  pushSection(5, 'Новые понимания', s.new_understandings);
  pushSection(6, 'Аффирмации', s.affirmations);
  pushSection(7, quotesTitle, s.quotes);
  pushSection(8, 'Вопросы на утро и вечер', [
    `Утро: ${s.questions_morning || '—'}`,
    `Вечер: ${s.questions_evening || '—'}`,
  ]);

  const links = s.links.length > 0 ? s.links.map((link, idx) => `Связка ${idx + 1}: ${formatLinkText(link)}`) : [];
  pushSection(9, 'Связки', links);
  if (!isSimplified) {
    pushSection(10, 'Таланты клиента', s.talents);
    pushSection(11, 'Повторяющиеся паттерны', s.destructive_patterns);
    pushSection(12, 'Мотивация', s.motivations);
    pushSection(13, 'Текущий контекст', [s.context]);
    pushSection(14, 'Генеалогия', [s.genealogy]);
  }

  return lines.join('\n').trim();
}

export function mapSummaryToVariables(summaryInput, selectedFields = null) {
  const s = normalizeSummary(summaryInput);
  const mainLink = clampString(formatLinkText(s.links[0]), 1000);
  const addLink = clampString(formatLinkText(s.links[1]), 1000);

  const changes = {
    q_morning: clampString(s.questions_morning, 1000),
    q_evening: clampString(s.questions_evening, 1000),
    link_main: mainLink,
    link_add: addLink,
    gpt_zapros: clampString(s.request, 1000),
    gpt_talants: clampString(s.talents.join('\n'), 1000),
    gpt_grabli: clampString(s.destructive_patterns.join('\n'), 1000),
    gpt_motiv: clampString(s.motivations.join('\n'), 1000),
    gpt_mycontext: clampString(s.context, 1000),
    gpt_affirmation: clampString(s.affirmations.join('\n'), 1000),
    gpt_quotes: clampString(s.quotes.join('\n'), 1000),
    gpt_situation: mainLink,
  };

  for (let i = 0; i < 10; i++) {
    changes[`aff${i + 1}`] = clampString(s.affirmations[i] || '', 1000);
    changes[`q${i + 1}`] = clampString(s.quotes[i] || '', 1000);
  }

  if (!Array.isArray(selectedFields) || selectedFields.length === 0) {
    return changes;
  }

  const set = new Set(selectedFields.map((key) => String(key)));
  const filtered = {};
  for (const [key, value] of Object.entries(changes)) {
    if (set.has(key)) filtered[key] = value;
  }
  return filtered;
}

function parsePromptResponse(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed.prompts)) {
      return parsed.prompts.map((prompt) => String(prompt || '').trim()).filter(Boolean);
    }
  } catch {}

  const numbered = trimmed
    .split(/^\s*\d\)\s+/m)
    .map((part) => part.trim())
    .filter(Boolean);
  if (numbered.length) return numbered;

  return trimmed
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function pushPosterBriefLine(lines, label, value, maxLength = 1200) {
  const text = clampString(value, maxLength);
  if (!text) return;
  lines.push(`${label}: ${text}`);
}

function pushPosterBriefList(lines, label, items, maxItems = 3, itemMaxLength = 240) {
  const normalized = normalizeArray(items, { maxItems, itemMaxLength });
  if (normalized.length === 0) return;
  lines.push(`${label}: ${normalized.join(' | ')}`);
}

function buildPosterBrief({ summaryJson, summaryText, summaryType = 'one_on_one' }) {
  const normalizedSummary = summaryJson ? normalizeSummary(summaryJson) : null;
  if (!normalizedSummary) {
    return clampString(summaryText, 6000);
  }

  const lines = [];
  pushPosterBriefLine(lines, 'Главный запрос клиента', normalizedSummary.request, 900);
  pushPosterBriefList(lines, 'Материальные последствия', normalizedSummary.material_consequences, 2, 220);
  pushPosterBriefList(lines, 'Эмоциональные последствия', normalizedSummary.emotional_consequences, 2, 220);
  pushPosterBriefList(lines, 'Главные ложные понимания', normalizedSummary.false_beliefs, 2, 260);
  pushPosterBriefList(lines, 'Главные новые понимания', normalizedSummary.new_understandings, 3, 280);
  pushPosterBriefList(lines, 'Таланты для опоры', normalizedSummary.talents, 2, 180);
  pushPosterBriefList(lines, 'Паттерны риска', normalizedSummary.destructive_patterns, 2, 180);
  pushPosterBriefList(lines, 'Мотивации', normalizedSummary.motivations, 2, 180);
  pushPosterBriefLine(lines, 'Текущий контекст клиента', normalizedSummary.context, 900);
  pushPosterBriefLine(lines, 'Генеалогический фон', normalizedSummary.genealogy, 700);
  if (normalizedSummary.links[0]) {
    pushPosterBriefLine(lines, 'Главная связка трансформации', formatLinkText(normalizedSummary.links[0]), 1100);
  }
  pushPosterBriefList(lines, 'Образные цитаты консультанта', normalizedSummary.quotes, 2, 220);

  const editedSummary = String(summaryText || '').trim();
  const renderedSummary = renderSummaryToMarkdown(normalizedSummary, { summaryType }).trim();
  if (editedSummary && editedSummary !== renderedSummary) {
    pushPosterBriefLine(
      lines,
      'Приоритетные акценты из отредактированного саммари',
      editedSummary,
      1500
    );
  }

  return lines.join('\n').trim();
}

export async function generatePosterPrompts({
  summaryText = '',
  summaryJson = null,
  summaryType = 'one_on_one',
} = {}) {
  const prompt = [
    'Ты арт-директор и prompt writer для генерации постеров.',
    'На основе контекста создай 3 сильных image-prompts для вертикального плаката на следующий месяц.',
    'Плакат должен передавать не пересказ консультации, а главную внутреннюю трансформацию клиента и вектор следующего месяца.',
    'Во всех вариантах обязателен aspect ratio 9:19.',
    'Каждый prompt должен быть copy-paste ready для image model и описывать один цельный кадр, а не коллаж.',
    'В каждом варианте обязателен один центральный образ или визуальная метафора, конкретная композиция, масштаб сцены, свет, палитра, материалы или фактуры, атмосфера и глубина.',
    'Показывай напряжение между старым и новым пониманием через символы, сцену и материальные детали.',
    'Используй конкретику клиента и сессии. Избегай общей абстрактной духовности без привязки к контексту.',
    'Если в саммари есть слова, которые звучат как текст для плаката, переводи их в предметы, архитектуру, природные явления, жесты, свет и пространство, а не в надписи.',
    'Не добавляй текст, буквы, подписи, логотипы, интерфейсы, водяные знаки, рамки, диптихи, комиксные панели, split screen.',
    'Каждый prompt должен быть плотным, визуальным и конкретным. Длина каждого prompt: 450-900 символов.',
    'Начинай сразу с визуальной сцены. Не пиши вступления вроде "Создай" или "Изобрази".',
    'Стиль 1: Мистический sci-fi постер, детализированная цифровая живопись, неоновое свечение, глубокие синие и золотые тона.',
    'Стиль 2: Абстрактный 3D-рендер, минималистичный футуризм, прозрачные материалы, светящиеся линии, эстетика чертежа.',
    'Стиль 3: Магический реализм, кинематографичное освещение, смесь грязи и магии.',
    'Пиши по-русски.',
    'Ответ строго в JSON без markdown и без комментариев.',
    'Формат: {"prompts":["...","...","..."]}.',
  ].join('\n');

  const maxInputChars = Number(process.env.POSTER_INPUT_MAX_CHARS || 3500);
  const source = buildPosterBrief({ summaryJson, summaryText, summaryType }) || String(summaryText || '');
  const summaryInput = Number.isFinite(maxInputChars) && maxInputChars > 0
    ? source.slice(0, maxInputChars)
    : source;
  const text = await callOpenAiText({
    instructions: prompt,
    input: `Контекст для плаката:\n${summaryInput}`,
    format: POSTER_PROMPTS_JSON_SCHEMA,
    reasoningEffort: 'low',
    store: false,
  });
  const prompts = parsePromptResponse(text).slice(0, 3);
  if (prompts.length < 3) {
    throw new Error('OpenAI response could not be parsed');
  }
  return prompts;
}

export async function sendEmail({ to, subject, body }) {
  const host = process.env.SMTP_HOST || process.env.SENDPULSE_SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.SENDPULSE_SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.SENDPULSE_SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SENDPULSE_SMTP_PASS;
  const from = process.env.MAIL_FROM;
  const replyTo = process.env.MAIL_REPLY_TO || from;
  const bcc = process.env.MAIL_BCC;

  if (!host || !user || !pass || !from) {
    throw new Error('SMTP email settings are not configured');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    replyTo,
    bcc,
    subject,
    text: body,
  });
}

export function safeErrorMessage(error) {
  if (error?.code === 'FILE_TOO_LARGE') {
    return 'Файл слишком большой (максимум 5 МБ).';
  }
  if (error?.name === 'AbortError') {
    return 'OpenAI превысил таймаут. Попробуйте снова.';
  }
  const msg = String(error?.message || '');
  if (msg.includes('OpenAI API key is not configured')) {
    return 'OpenAI не настроен на сервере.';
  }
  if (msg.includes('invalid_api_key') || msg.includes('Incorrect API key provided')) {
    return 'На сервере задан неверный или истёкший OPENAI_API_KEY.';
  }
  if (msg.includes('OpenAI error')) {
    return 'Ошибка запроса к OpenAI.';
  }
  if (msg.includes('OpenAI refusal')) {
    return 'OpenAI отказался формировать ответ для этого запроса.';
  }
  if (msg.includes('fetch failed')) {
    return 'Сервер не дождался ответа OpenAI. Попробуйте снова.';
  }
  if (msg.includes('Invalid JSON response')) {
    return 'OpenAI вернул некорректный JSON, попробуйте снова.';
  }
  if (msg.includes('Empty response from OpenAI')) {
    return 'OpenAI вернул пустой ответ.';
  }
  if (msg.includes('SMTP email settings are not configured')) {
    return 'Email-отправка не настроена на сервере.';
  }
  if (msg.includes('OpenAI response could not be parsed')) {
    return 'Не удалось распарсить ответ OpenAI.';
  }
  return 'Не удалось обработать запрос. Попробуйте позже.';
}

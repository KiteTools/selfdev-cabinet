import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query as dbQuery } from './lib/db.js';
import {
  SUMMARY_TEMPLATES,
  MAX_FILE_BYTES,
  parseMultipartForm,
  extractTextFromFile,
  truncateText,
  resolveTruncationLimit,
  buildPromptInput,
  callOpenAiSummary,
  normalizeSummary,
  renderSummaryToMarkdown,
  sendEmail,
  safeErrorMessage,
} from './lib/summarizer.js';

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function getContentType(event) {
  return event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
}

function getQueryParam(event, key) {
  if (event.queryStringParameters?.[key] !== undefined) {
    return event.queryStringParameters[key];
  }
  const params = new URLSearchParams(event.rawQuery || '');
  return params.get(key);
}

async function markConsultationFailed({ consultationId, message, query, userId, claimed = false }) {
  if (!consultationId) return;
  await query(
    `UPDATE consultations
     SET status = 'failed',
         summary_json = NULL,
         summary_text = NULL,
         error_message = $2
     WHERE id = $1 AND user_id = $3 AND status <> 'completed'
       AND (processing_started_at IS NULL OR $4::boolean)`,
    [consultationId, message, userId, claimed]
  );
}

export function createSummaryBackgroundHandler({ query = dbQuery, authenticate = authenticateRequest, parseForm = parseMultipartForm, runSummary = callOpenAiSummary } = {}) {
return async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticate(event);
  if (!user) return jsonResponse(401, { error: 'Unauthorized' });

  const consultationIdFromQuery = String(getQueryParam(event, 'id') || '').trim();

  if (!getContentType(event).includes('multipart/form-data')) {
    return jsonResponse(400, { error: 'Invalid content type' });
  }

  let fields;
  let files;
  try {
    const parsed = await parseForm(event);
    fields = parsed.fields || {};
    files = parsed.files || {};
  } catch (error) {
    const message = error?.code === 'FILE_TOO_LARGE'
      ? 'Файл слишком большой (максимум 5 МБ).'
      : 'Некорректные данные формы';
    return jsonResponse(400, { error: message });
  }

  if (fields.company) {
    return jsonResponse(400, { error: 'Bot detected' });
  }

  const consultationId = String(
    consultationIdFromQuery || fields.consultationId || fields.jobId || ''
  ).trim();
  if (!isValidUuid(consultationId)) {
    return jsonResponse(400, { error: 'consultationId required (uuid)' });
  }

  const failEarly = async (message, statusCode = 400) => {
    await markConsultationFailed({
      consultationId,
      message,
      query,
      userId: user.user_id,
    });
    return jsonResponse(statusCode, { error: message, id: consultationId });
  };

  const consultationRows = await query(
    `SELECT id, user_id, status, summary_type
     FROM consultations
     WHERE id = $1 AND user_id = $2`,
    [consultationId, user.user_id]
  );
  if (consultationRows.length === 0) {
    return jsonResponse(404, { error: 'Консультация не найдена', id: consultationId });
  }
  const consultation = consultationRows[0];
  if (consultation.status === 'completed') return jsonResponse(200, { ok: true, id: consultationId });

  const transcriptFile = files.transcript;
  if (!transcriptFile) {
    return failEarly('Отсутствует файл транскрипции');
  }
  if (transcriptFile.size > MAX_FILE_BYTES) {
    return failEarly('Файл слишком большой (максимум 5 МБ).');
  }

  const summaryType = String(fields.summaryType || 'one_on_one');
  const email = String(fields.email || '').trim();
  const shouldSendEmail = /.+@.+\..+/.test(email);
  if (!SUMMARY_TEMPLATES[summaryType]) {
    return failEarly('Некорректный тип саммари');
  }

  try {
    const claimed = await query(
      `UPDATE consultations
       SET status = 'processing',
           processing_started_at = now(),
           summary_type = $2,
           summary_json = NULL,
           summary_text = NULL,
           error_message = NULL
       WHERE id = $1 AND user_id = $3 AND processing_started_at IS NULL
       RETURNING id`,
      [consultationId, summaryType, user.user_id]
    );

    if (!claimed.length) return jsonResponse(202, { ok: true, id: consultationId, status: 'already_started' });

    const notesFile = files.notes;
    const transcriptTextRaw = extractTextFromFile(transcriptFile);
    const notesTextRaw = notesFile ? extractTextFromFile(notesFile) : '';

    const headChars = resolveTruncationLimit(process.env.TRUNCATE_HEAD_CHARS, 12000, 12000);
    const tailChars = resolveTruncationLimit(process.env.TRUNCATE_TAIL_CHARS, 8000, 8000);

    const truncatedTranscript = truncateText(transcriptTextRaw, headChars, tailChars);
    const truncatedNotes = notesTextRaw
      ? truncateText(notesTextRaw, headChars, tailChars)
      : { text: '', truncated: false };

    const input = buildPromptInput(truncatedTranscript.text, truncatedNotes.text);
    console.info('summarize-background prompt prepared', {
      consultationId,
      summaryType,
      transcriptChars: transcriptTextRaw.length,
      notesChars: notesTextRaw.length,
      promptChars: input.length,
      transcriptTruncated: truncatedTranscript.truncated,
      notesTruncated: truncatedNotes.truncated,
      headChars,
      tailChars,
    });
    const summaryJson = await runSummary({
      summaryType,
      input,
      hasNotes: Boolean(truncatedNotes.text),
    });

    await query(
      `UPDATE consultations
       SET status = 'completed',
           summary_json = $2::jsonb,
           summary_text = NULL,
           error_message = NULL
       WHERE id = $1 AND user_id = $3`,
      [consultationId, JSON.stringify(summaryJson), user.user_id]
    );

    if (shouldSendEmail) {
      try {
        const summaryText = renderSummaryToMarkdown(normalizeSummary(summaryJson), {
          summaryType,
        });
        const subject = `Саммари консультации — ${new Date().toLocaleDateString('ru-RU')}`;
        await sendEmail({ to: email, subject, body: summaryText });
      } catch (emailError) {
        console.error('summarize-background auto email failed', {
          consultationId,
          error: emailError?.message,
        });
      }
    }

    return jsonResponse(200, { ok: true, id: consultationId });
  } catch (error) {
    const message = safeErrorMessage(error);
    console.error('summarize-background error', {
      consultationId,
      errorName: error?.name,
      errorMessage: error?.message,
    });

    await markConsultationFailed({
      consultationId,
      message,
      query,
      userId: user.user_id,
      claimed: true,
    });

    if (shouldSendEmail) {
      try {
        const subject = `Саммари консультации — ошибка`;
        const body = `Консультация ${consultationId} завершилась с ошибкой:\n\n${message}`;
        await sendEmail({ to: email, subject, body });
      } catch (emailError) {
        console.error('summarize-background failure email failed', {
          consultationId,
          error: emailError?.message,
        });
      }
    }

    return jsonResponse(500, { error: message, id: consultationId });
  }
};

}
export const handler = createSummaryBackgroundHandler();

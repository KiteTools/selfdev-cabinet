import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { buildUnderstandingDocs, isValidUuid, mapUnderstandingDocRow } from './lib/phase4.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const consultationId = String(body.consultation_id || '').trim();
  const activate = body.activate !== false;

  if (!isValidUuid(consultationId)) {
    return jsonResponse(400, { error: 'consultation_id required (uuid)' });
  }

  try {
    const consultationRows = await query(
      `SELECT id, status, summary_json
       FROM consultations
       WHERE id = $1
         AND user_id = $2`,
      [consultationId, user.user_id]
    );

    if (consultationRows.length === 0) {
      return jsonResponse(404, { error: 'Консультация не найдена' });
    }

    const consultation = consultationRows[0];
    if (consultation.status !== 'completed' || !consultation.summary_json) {
      return jsonResponse(409, { error: 'Саммари консультации ещё не готово' });
    }

    const docs = buildUnderstandingDocs(consultation.summary_json, consultation.id);
    const created = [];

    for (const doc of docs) {
      if (activate) {
        await query(
          `UPDATE understanding_docs
           SET status = 'inactive',
               updated_at = now()
           WHERE user_id = $1
             AND doc_type = $2
             AND status = 'active'`,
          [user.user_id, doc.doc_type]
        );
      }

      const rows = await query(
        `INSERT INTO understanding_docs (
           user_id, doc_type, status, title, content_md, source_consultation_id
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, doc_type, status, title, content_md, source_consultation_id, created_at, updated_at`,
        [
          user.user_id,
          doc.doc_type,
          activate ? 'active' : 'inactive',
          doc.title,
          doc.content_md,
          doc.source_consultation_id,
        ]
      );
      created.push(mapUnderstandingDocRow(rows[0]));
    }

    return jsonResponse(200, {
      ok: true,
      items: created,
    });
  } catch (error) {
    console.error('understanding-docs-generate error:', error);
    return jsonResponse(500, { error: 'Не удалось создать документы разбора' });
  }
};

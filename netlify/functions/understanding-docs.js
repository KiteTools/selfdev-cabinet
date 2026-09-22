import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import {
  isValidUuid,
  mapUnderstandingDocRow,
  UNDERSTANDING_DOC_TYPE_IDS,
} from './lib/phase4.js';

export const handler = async (event) => {
  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  if (event.httpMethod === 'GET') {
    try {
      const rows = await query(
        `SELECT id, doc_type, status, title, content_md, source_consultation_id, created_at, updated_at
         FROM understanding_docs
         WHERE user_id = $1
         ORDER BY updated_at DESC, created_at DESC`,
        [user.user_id]
      );

      const items = rows.map(mapUnderstandingDocRow);
      const active = {};
      for (const docType of UNDERSTANDING_DOC_TYPE_IDS) {
        active[docType] = items.find((item) => item.doc_type === docType && item.status === 'active') || null;
      }

      return jsonResponse(200, { items, active });
    } catch (error) {
      console.error('understanding-docs list error:', error);
      return jsonResponse(500, { error: 'Не удалось загрузить документы разбора' });
    }
  }

  if (event.httpMethod === 'PATCH') {
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON' });
    }

    const id = String(body.id || '').trim();
    const title = String(body.title || '').trim();
    const contentMd = String(body.content_md || '').trim();

    if (!isValidUuid(id)) {
      return jsonResponse(400, { error: 'id required (uuid)' });
    }
    if (!title) {
      return jsonResponse(400, { error: 'title required' });
    }
    if (!contentMd) {
      return jsonResponse(400, { error: 'content_md required' });
    }

    try {
      const rows = await query(
        `UPDATE understanding_docs
         SET title = $3,
             content_md = $4,
             updated_at = now()
         WHERE id = $1
           AND user_id = $2
         RETURNING id, doc_type, status, title, content_md, source_consultation_id, created_at, updated_at`,
        [id, user.user_id, title, contentMd]
      );

      if (rows.length === 0) {
        return jsonResponse(404, { error: 'Документ не найден' });
      }

      return jsonResponse(200, {
        ok: true,
        item: mapUnderstandingDocRow(rows[0]),
      });
    } catch (error) {
      console.error('understanding-docs patch error:', error);
      return jsonResponse(500, { error: 'Не удалось сохранить документ' });
    }
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

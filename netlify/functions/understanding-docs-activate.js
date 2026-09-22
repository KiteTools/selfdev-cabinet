import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { isValidUuid, mapUnderstandingDocRow } from './lib/phase4.js';

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

  const id = String(body.id || '').trim();
  if (!isValidUuid(id)) {
    return jsonResponse(400, { error: 'id required (uuid)' });
  }

  try {
    const rows = await query(
      `SELECT id, doc_type
       FROM understanding_docs
       WHERE id = $1
         AND user_id = $2`,
      [id, user.user_id]
    );
    if (rows.length === 0) {
      return jsonResponse(404, { error: 'Документ не найден' });
    }

    const doc = rows[0];
    await query(
      `UPDATE understanding_docs
       SET status = 'inactive',
           updated_at = now()
       WHERE user_id = $1
         AND doc_type = $2
         AND status = 'active'`,
      [user.user_id, doc.doc_type]
    );

    const updated = await query(
      `UPDATE understanding_docs
       SET status = 'active',
           updated_at = now()
       WHERE id = $1
         AND user_id = $2
       RETURNING id, doc_type, status, title, content_md, source_consultation_id, created_at, updated_at`,
      [id, user.user_id]
    );

    return jsonResponse(200, {
      ok: true,
      item: mapUnderstandingDocRow(updated[0]),
    });
  } catch (error) {
    console.error('understanding-docs-activate error:', error);
    return jsonResponse(500, { error: 'Не удалось активировать документ' });
  }
};

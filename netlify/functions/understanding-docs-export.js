import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { getQueryParam, isValidUuid } from './lib/phase4.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const id = String(getQueryParam(event, 'id') || '').trim();
  if (!isValidUuid(id)) {
    return jsonResponse(400, { error: 'id required (uuid)' });
  }

  try {
    const rows = await query(
      `SELECT title, content_md
       FROM understanding_docs
       WHERE id = $1
         AND user_id = $2`,
      [id, user.user_id]
    );

    if (rows.length === 0) {
      return jsonResponse(404, { error: 'Документ не найден' });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(rows[0].title || 'document.md')}"`,
      },
      body: String(rows[0].content_md || ''),
    };
  } catch (error) {
    console.error('understanding-docs-export error:', error);
    return jsonResponse(500, { error: 'Не удалось экспортировать документ' });
  }
};

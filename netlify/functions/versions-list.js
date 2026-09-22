import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const rows = await query(
    `SELECT id, created_at, data FROM versions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [user.user_id]
  );

  return jsonResponse(200, { versions: rows });
};

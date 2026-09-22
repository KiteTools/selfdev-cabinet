import { authenticateRequest, jsonResponse } from './lib/auth.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  return jsonResponse(200, {
    user_id: user.user_id,
    telegram_user_id: user.telegram_user_id,
  });
};

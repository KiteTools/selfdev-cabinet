import {
  buildSessionCookie,
  createToken,
  jsonResponse,
  jsonResponseWithCookie,
} from './lib/auth.js';
import { authorizeServiceRequest } from './lib/service-auth.js';
import { getUserById, getUserBySendPulseContactId } from './lib/users.js';

export function createAuthCliHandler({
  authorize = authorizeServiceRequest,
  getByContact = getUserBySendPulseContactId,
  getById = getUserById,
  signToken = createToken,
  makeCookie = buildSessionCookie,
} = {}) {
  return async function handler(event) {
    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed' });
    }

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON' });
    }

    const spContactId = String(body.sp_contact_id || '').trim();
    const userId = String(body.user_id || '').trim();

    if (!spContactId && !userId) {
      return jsonResponse(400, { error: 'sp_contact_id or user_id required' });
    }

    const auth = await authorize(event, {
      scope: 'cli_auth',
      spContactId,
      maxRequests: 60,
    });

    if (!auth.ok) {
      return jsonResponse(auth.statusCode, { error: auth.error });
    }

    const user = spContactId
      ? await getByContact(spContactId)
      : await getById(userId);

    if (!user) {
      return jsonResponse(404, { error: 'User not found' });
    }

    const token = await signToken({
      user_id: user.id,
      telegram_user_id: user.telegram_user_id,
      sendpulse_contact_id: user.sendpulse_contact_id,
    });

    return jsonResponseWithCookie(
      200,
      {
        ok: true,
        auth_mode: 'jwt_cookie',
        user: {
          id: user.id,
          telegram_user_id: user.telegram_user_id,
          sendpulse_contact_id: user.sendpulse_contact_id,
        },
      },
      makeCookie(token)
    );
  };
}

export const handler = createAuthCliHandler();

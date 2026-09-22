import { jsonResponse } from './lib/auth.js';
import { getTransport } from './lib/transport.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  return jsonResponse(200, {
    telegram_bot_username: process.env.TELEGRAM_BOT_USERNAME || '',
    transport: getTransport().kind,
    contact_id_required: getTransport().kind === 'sendpulse',
    bot_timezone: process.env.BOT_TIMEZONE || 'UTC',
  });
};

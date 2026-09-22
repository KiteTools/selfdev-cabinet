import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { getContactVariables, getTransport } from './lib/transport.js';
import { deriveStateChanges, fromSendPulse, normalizeDerivedState } from './lib/variables.js';
import { query } from './lib/db.js';
import { getCurrentState } from './lib/state.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  try {
    // Read fresh variables from SendPulse
    const spVars = await getContactVariables(user.sendpulse_contact_id);
    const currentState = await getCurrentState(user.user_id);
    const spState = fromSendPulse(spVars, currentState.tz);
    const normalizedChanges = deriveStateChanges(currentState, spState);
    const state = normalizeDerivedState({ ...currentState, ...normalizedChanges });

    // Update current_state in DB (without creating a version)
    await query(
      `INSERT INTO current_state (user_id, data) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = now()`,
      [user.user_id, JSON.stringify(state)]
    );

    return jsonResponse(200, { data: state, transport: getTransport().kind });
  } catch (err) {
    console.error('state-get error:', err);
    return jsonResponse(500, { error: 'Ошибка загрузки данных' });
  }
};

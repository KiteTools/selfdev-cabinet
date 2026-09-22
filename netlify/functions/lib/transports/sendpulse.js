import { query as defaultQuery } from '../db.js';

const API = 'https://api.sendpulse.com';

/** Server-only adapter. Dependencies are injectable for offline contract tests. */
export function createSendPulseTransport({ query = defaultQuery, fetchImpl = fetch, env = process.env, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now } = {}) {
  function requireEnv(name) {
    if (!env[name]) throw new Error(`${name} is not configured`);
    return env[name];
  }
  async function getAccessToken() {
    const rows = await query('SELECT access_token, expires_at FROM sp_token WHERE id = 1');
    if (rows[0]?.access_token && new Date(rows[0].expires_at).getTime() > now() + 60_000) return rows[0].access_token;
    const res = await fetchImpl(`${API}/oauth/access_token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: requireEnv('SENDPULSE_CLIENT_ID'), client_secret: requireEnv('SENDPULSE_CLIENT_SECRET') }),
    });
    if (!res.ok) throw new Error(`SendPulse OAuth failed (${res.status})`);
    const data = await res.json();
    if (!data.access_token || !(Number(data.expires_in) > 0)) throw new Error('Invalid SendPulse OAuth response');
    await query(`INSERT INTO sp_token (id, access_token, expires_at) VALUES (1, $1, $2)
      ON CONFLICT (id) DO UPDATE SET access_token = $1, expires_at = $2`,
      [data.access_token, new Date(now() + Number(data.expires_in) * 1000).toISOString()]);
    return data.access_token;
  }
  async function spFetch(path, options = {}, retry = true) {
    const token = await getAccessToken();
    const res = await fetchImpl(`${API}${path}`, { ...options, signal: AbortSignal.timeout(15_000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
    if (res.status === 401 && retry) {
      await query('DELETE FROM sp_token WHERE id = 1');
      return spFetch(path, options, false);
    }
    return res;
  }
  async function readContact(path) {
    const res = await spFetch(path);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`SendPulse contact lookup failed (${res.status})`);
    const data = await res.json();
    if (data.success === false) return null;
    return data.data && typeof data.data === 'object' ? data.data : null;
  }
  async function getContact(contactId) {
    return readContact(`/telegram/contacts/get?${new URLSearchParams({ id: contactId })}`);
  }
  async function resolveContactForTelegram({ telegramUserId, requestedContactId }) {
    if (!/^[1-9]\d*$/.test(String(telegramUserId)) || typeof requestedContactId !== 'string' || !requestedContactId) return null;
    const params = new URLSearchParams({ bot_id: requireEnv('SENDPULSE_BOT_ID'), telegram_id: String(telegramUserId) });
    const contact = await readContact(`/telegram/contacts/getByTelegramId?${params}`);
    return contact && typeof contact.id === 'string' && contact.id === requestedContactId
      && String(contact.telegram_id) === String(telegramUserId) && contact.bot_id === env.SENDPULSE_BOT_ID ? contact : null;
  }
  async function getContactVariables(contactId) {
    const contact = await getContact(contactId);
    if (!contact) throw new Error('Contact not found');
    if (Array.isArray(contact.variables)) return Object.fromEntries(contact.variables.filter(v => typeof v.name === 'string').map(v => [v.name, v.value]));
    return contact.variables && typeof contact.variables === 'object' ? { ...contact.variables } : {};
  }
  async function setVariable(contactId, name, value) {
    const res = await spFetch('/telegram/contacts/setVariable', {
      method: 'POST', body: JSON.stringify({ contact_id: contactId, variables: [{ variable_name: name, variable_value: String(value) }] }),
    });
    if (!res.ok) {
      const error = new Error(`SendPulse variable update failed (${res.status})`);
      if (res.status === 429) error.status = 429;
      throw error;
    }
    // Some API errors are reported in a successful HTTP envelope.
    const text = await res.text();
    if (text && JSON.parse(text).success === false) throw new Error('SendPulse variable update rejected');
  }
  async function syncVariables(contactId, vars) {
    for (const [name, value] of Object.entries(vars)) {
      for (let attempt = 0; ; attempt++) {
        try { await setVariable(contactId, name, value); break; }
        catch (error) {
          if (error.status !== 429 || attempt >= 3) throw error;
          await sleep(2000 * (2 ** attempt));
        }
      }
    }
    return { transport: 'sendpulse', delivered: true };
  }
  return { kind: 'sendpulse', resolveContactForTelegram, getContact, getContactVariables, setVariable, syncVariables, getAccessToken };
}

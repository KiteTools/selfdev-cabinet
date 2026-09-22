import { query } from './db.js';

export async function getUserBySendPulseContactId(sendpulseContactId) {
  const contactId = String(sendpulseContactId || '').trim();
  if (!contactId) return null;

  const rows = await query(
    `SELECT id, telegram_user_id, sendpulse_contact_id
     FROM users
     WHERE sendpulse_contact_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [contactId]
  );

  return rows[0] || null;
}

export async function getUserById(userId) {
  const id = String(userId || '').trim();
  if (!id) return null;

  const rows = await query(
    `SELECT id, telegram_user_id, sendpulse_contact_id
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

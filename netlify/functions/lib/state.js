import { query } from './db.js';

export async function getCurrentState(userId) {
  const rows = await query(
    'SELECT data FROM current_state WHERE user_id = $1',
    [userId]
  );
  return rows.length > 0 ? (rows[0].data || {}) : {};
}

export async function mergeCurrentState(userId, changes) {
  await query(
    `INSERT INTO current_state (user_id, data)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id)
     DO UPDATE SET
       data = current_state.data || EXCLUDED.data,
       updated_at = now()`,
    [userId, JSON.stringify(changes || {})]
  );

  return getCurrentState(userId);
}

export async function replaceCurrentState(userId, state) {
  await query(
    `INSERT INTO current_state (user_id, data)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id)
     DO UPDATE SET
       data = EXCLUDED.data,
       updated_at = now()`,
    [userId, JSON.stringify(state || {})]
  );
}

export async function upsertTodayVersion(userId, snapshot, keepLimit = 5) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await query(
    `SELECT id FROM versions
     WHERE user_id = $1
       AND created_at::date = $2::date
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, today]
  );

  if (existing.length > 0) {
    await query(
      `UPDATE versions
       SET data = $2::jsonb, created_at = now()
       WHERE id = $1`,
      [existing[0].id, JSON.stringify(snapshot || {})]
    );
    return;
  }

  await query(
    'INSERT INTO versions (user_id, data) VALUES ($1, $2::jsonb)',
    [userId, JSON.stringify(snapshot || {})]
  );

  await query(
    `DELETE FROM versions
     WHERE user_id = $1
       AND id NOT IN (
         SELECT id
         FROM versions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       )`,
    [userId, keepLimit]
  );
}

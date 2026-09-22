import { neon } from '@netlify/neon';

let _sql;

function getClient() {
  if (!_sql) {
    const connection = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
    if (!connection) throw new Error('Database URL is not configured');
    _sql = neon(connection);
  }
  return _sql;
}

/**
 * Execute a parameterized SQL query.
 * @param {string} text - SQL with $1, $2, ... placeholders
 * @param {any[]} params - Parameter values
 * @returns {Promise<any[]>} - Array of rows
 */
export async function query(text, params = []) {
  const sql = getClient();
  const result = await sql.query(text, params);
  return Array.isArray(result) ? result : (result.rows || []);
}

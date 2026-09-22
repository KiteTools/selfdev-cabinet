import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function migrationPlan(root = ROOT) {
  const names = (await readdir(join(root, 'migrations'))).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  return Promise.all(names.map(async name => {
    const sql = await readFile(join(root, 'migrations', name), 'utf8');
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}
export function migrationSql(plan) {
  const parts = ['BEGIN;', 'SELECT pg_advisory_xact_lock(7194021);', 'CREATE TABLE IF NOT EXISTS cabinet_schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());'];
  for (const { name, sql, checksum } of plan) {
    if (!/^\d{3}_[a-z0-9_]+\.sql$/.test(name) || !/^[a-f0-9]{64}$/.test(checksum)) throw new Error('Invalid migration descriptor');
    parts.push(`DO $migration$ BEGIN IF EXISTS (SELECT 1 FROM cabinet_schema_migrations WHERE name = '${name}' AND checksum <> '${checksum}') THEN RAISE EXCEPTION 'Migration checksum mismatch: ${name}'; END IF; END $migration$;`,
      `SELECT EXISTS (SELECT 1 FROM cabinet_schema_migrations WHERE name = '${name}') AS migration_applied \\gset`,
      '\\if :migration_applied', `\\echo Already applied: ${name}`, '\\else', sql,
      `INSERT INTO cabinet_schema_migrations (name, checksum) VALUES ('${name}', '${checksum}');`, '\\endif');
  }
  parts.push('COMMIT;');
  return parts.join('\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) throw new Error('Usage: npm run migrate -- [--apply]');
  const plan = await migrationPlan();
  if (!args.includes('--apply')) {
    console.log('Dry run: no database connection. Files in order (database application state is unknown):');
    for (const item of plan) console.log(`${item.name} ${item.checksum.slice(0, 12)}`);
    console.log('Apply to your configured database with npm run migrate -- --apply');
  } else {
    const connection = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
    if (!connection) throw new Error('DATABASE_URL or NETLIFY_DATABASE_URL is required');
    // Credentials travel through the child environment, never command arguments or logs.
    const child = spawnSync('psql', ['-X', '--no-password', '--set', 'ON_ERROR_STOP=on'], { env: { ...process.env, PGDATABASE: connection }, input: migrationSql(plan), stdio: ['pipe', 'inherit', 'pipe'], encoding: 'utf8' });
    if (child.error || child.status !== 0) {
      console.error('Migration failed; transaction rolled back. Confirm psql installation, database access and schema compatibility. Raw database errors are withheld to avoid leaking credentials.');
      process.exitCode = 1;
    } else console.log('Migration transaction committed.');
  }
}

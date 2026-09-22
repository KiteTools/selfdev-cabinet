import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';
import { checkEnvironment } from '../scripts/check-env.mjs';
import { migrationPlan, migrationSql } from '../scripts/migrate.mjs';
import { setup } from '../scripts/setup.mjs';

test('public build copies only the explicit manifest, excluding planted backend and secret files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cabinet-build-'));
  try {
    await mkdir(join(root, 'assets'));
    await writeFile(join(root, 'index.html'), '<h1>Synthetic app</h1>');
    await writeFile(join(root, 'assets/app.js'), 'export const synthetic = true;');
    await writeFile(join(root, 'assets/private.js'), 'PRIVATE');
    await writeFile(join(root, '.env'), 'PRIVATE');
    await writeFile(join(root, 'public-files.json'), JSON.stringify(['index.html', 'assets/app.js']));
    await build(root);
    assert.deepEqual((await readdir(join(root, 'dist'))).sort(), ['assets', 'index.html']);
    assert.deepEqual(await readdir(join(root, 'dist/assets')), ['app.js']);
    await writeFile(join(root, 'public-files.json'), JSON.stringify(['../outside.js']));
    await assert.rejects(build(root), /Invalid public path/);
    assert.match(await readFile(join(root, 'dist/index.html'), 'utf8'), /Synthetic/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('environment checker requires only chosen integrations and never reports values', () => {
  const env = { DATABASE_URL: 'postgresql://synthetic:secret@example.invalid/db?sslmode=require', TELEGRAM_BOT_TOKEN: 'synthetic', TELEGRAM_BOT_USERNAME: 'example_bot', JWT_SECRET: 's'.repeat(32), CABINET_TRANSPORT: 'local' };
  assert.deepEqual(checkEnvironment(env).errors, []);
  const invalid = checkEnvironment({ ...env, CABINET_TRANSPORT: 'sendpulse' });
  assert.ok(invalid.errors.some(s => s.includes('SENDPULSE_BOT_ID')));
  assert.ok(!JSON.stringify(invalid).includes('synthetic:secret'));
  assert.ok(checkEnvironment({ ...env, BOT_TIMEZONE: 'invalid' }).errors.length);
});

test('setup refuses to overwrite existing settings and generates distinct server secrets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cabinet-setup-'));
  try {
    await writeFile(join(root, '.env.example'), 'JWT_SECRET=\nLK_SERVICE_SECRET=\n');
    await setup(root);
    const first = await readFile(join(root, '.env'), 'utf8');
    assert.match(first, /JWT_SECRET=[a-f0-9]{64}/);
    assert.match(first, /LK_SERVICE_SECRET=[a-f0-9]{64}/);
    await assert.rejects(setup(root), /EEXIST/);
    assert.equal(await readFile(join(root, '.env'), 'utf8'), first);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('migration plan is ordered, checksummed, transaction guarded and does not contain credentials', async () => {
  const plan = await migrationPlan();
  assert.equal(plan[0].name, '001_init.sql');
  assert.ok(plan.length >= 16);
  const sql = migrationSql(plan);
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /checksum mismatch/);
  assert.match(sql, /\\if :migration_applied/);
  assert.match(sql, /COMMIT;/);
  assert.doesNotMatch(sql, /postgresql:\/\//);
});

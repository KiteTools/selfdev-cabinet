import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function setup(root = ROOT) {
  let template = await readFile(join(root, '.env.example'), 'utf8');
  for (const key of ['JWT_SECRET', 'LK_SERVICE_SECRET', 'SENDPULSE_DIARY_SECRET']) template = template.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${randomBytes(32).toString('hex')}`);
  await writeFile(join(root, '.env'), template, { flag: 'wx', mode: 0o600 });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await setup();
  console.log('Created .env with new server secrets. Fill in your own accounts; never commit this file.');
}

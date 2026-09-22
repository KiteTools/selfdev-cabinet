import { readFile, mkdir, copyFile, lstat, rm, rename } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function build(root = ROOT) {
  const files = JSON.parse(await readFile(join(root, 'public-files.json'), 'utf8'));
  for (const file of files) {
    if (typeof file !== 'string' || (file !== 'index.html' && !/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:js|mjs|css)$/.test(file))) throw new Error('Invalid public path');
    let partPath = root;
    for (const part of file.split('/')) {
      partPath = join(partPath, part);
      if ((await lstat(partPath)).isSymbolicLink()) throw new Error('Public symlinks are forbidden');
    }
    if (!(await lstat(join(root, file))).isFile()) throw new Error('Public entry is not a file');
  }
  const stage = join(root, '.dist-build');
  const dist = join(root, 'dist');
  for (const path of [stage, dist]) {
    try { if ((await lstat(path)).isSymbolicLink()) throw new Error('Build destination symlinks are forbidden'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage);
  for (const file of files) {
    await mkdir(dirname(join(stage, file)), { recursive: true });
    await copyFile(join(root, file), join(stage, file));
  }
  await rm(dist, { recursive: true, force: true });
  await rename(stage, dist);
  return files.length;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`Built ${await build()} public files into dist/`);

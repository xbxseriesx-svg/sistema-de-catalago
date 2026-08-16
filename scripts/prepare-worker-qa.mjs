import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

const root = '.wrangler-dry-run';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

await mkdir(root, { recursive: true });
const files = await walk(root);
const candidates = [];
for (const path of files) {
  if (!/\.js$/i.test(path) || basename(path) === 'index.js') continue;
  candidates.push({ path, size: (await stat(path)).size });
}

candidates.sort((a, b) => {
  const aPreferred = /index-v\d+\.js$/i.test(a.path) ? 1 : 0;
  const bPreferred = /index-v\d+\.js$/i.test(b.path) ? 1 : 0;
  return bPreferred - aPreferred || b.size - a.size;
});

if (!candidates.length) {
  throw new Error(`Nenhum bundle JavaScript encontrado em ${root}. Arquivos: ${files.join(', ')}`);
}

await copyFile(candidates[0].path, join(root, 'index.js'));
console.log(`Bundle QA preparado: ${candidates[0].path} -> ${root}/index.js`);

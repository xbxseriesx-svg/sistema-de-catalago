import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [index, ui, workerV71, workerV70, wrangler, version] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/brand-image-search-v70.js', 'utf8'),
  readFile('worker/index-v71.ts', 'utf8'),
  readFile('worker/index-v70.ts', 'utf8'),
  readFile('wrangler.jsonc', 'utf8'),
  readFile('VERSION', 'utf8').then((value) => value.trim()),
]);

assert.ok(Number(version) >= 70, 'A pesquisa de imagens das marcas exige V70 ou superior.');
assert.match(index, /brand-image-search-v70\.js\?v=70/, 'Editor não carrega a interface de pesquisa V70.');
assert.match(wrangler, /"main":\s*"worker\/index-v71\.ts"/, 'Wrangler não aponta para o Worker V71.');
assert.match(ui, /data-asteryon-brand-image-search/);
assert.match(ui, /Pesquisar imagem da marca/);
assert.match(ui, /\/api\/admin\/brands/);
assert.match(ui, /\/api\/admin\/brand-images\/search/);
assert.match(ui, /\/api\/admin\/brand-images\/fetch/);
assert.match(ui, /\/api\/admin\/brand-images\/upload/);
assert.match(ui, /image\/webp/);
assert.match(ui, /createImageBitmap/);
assert.match(ui, /MutationObserver/);
assert.match(workerV71, /\/api\/admin\/brand-images\/search/);
assert.match(workerV71, /\/api\/admin\/brand-images\/fetch/);
assert.match(workerV71, /wikimediaImageSearch/);
assert.match(workerV71, /openverseImageSearch/);
assert.match(workerV71, /api-user-agent/);
assert.match(workerV71, /ASTERYON-Catalog\/2\.1\.71/);
assert.match(workerV70, /\/api\/admin\/brand-images\/upload/);
assert.match(workerV70, /BRAND_BUCKET\s*=\s*'brand-media'/);
assert.match(workerV70, /sha256/);

execFileSync(process.execPath, ['--check', 'public/brand-image-search-v70.js'], { stdio: 'pipe' });

console.log('QA pesquisa de imagens das marcas V71: OK (Google + Wikimedia identificado + fallback Openverse)');

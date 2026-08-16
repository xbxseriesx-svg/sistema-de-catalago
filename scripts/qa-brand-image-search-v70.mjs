import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [index, ui, worker, wrangler, version] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/brand-image-search-v70.js', 'utf8'),
  readFile('worker/index-v70.ts', 'utf8'),
  readFile('wrangler.jsonc', 'utf8'),
  readFile('VERSION', 'utf8').then((value) => value.trim()),
]);

assert.equal(version, '70', 'A pesquisa de imagens das marcas pertence à V70.');
assert.match(index, /brand-image-search-v70\.js\?v=70/, 'Editor não carrega a interface de pesquisa V70.');
assert.match(wrangler, /"main":\s*"worker\/index-v70\.ts"/, 'Wrangler não aponta para o Worker V70.');
assert.match(ui, /data-asteryon-brand-image-search/);
assert.match(ui, /Pesquisar imagem da marca/);
assert.match(ui, /\/api\/admin\/brands/);
assert.match(ui, /\/api\/admin\/brand-images\/search/);
assert.match(ui, /\/api\/admin\/brand-images\/fetch/);
assert.match(ui, /\/api\/admin\/brand-images\/upload/);
assert.match(ui, /image\/webp/);
assert.match(ui, /createImageBitmap/);
assert.match(ui, /MutationObserver/);
assert.match(worker, /\/api\/admin\/brand-images\/search/);
assert.match(worker, /\/api\/admin\/brand-images\/fetch/);
assert.match(worker, /\/api\/admin\/brand-images\/upload/);
assert.match(worker, /BRAND_BUCKET\s*=\s*'brand-media'/);
assert.match(worker, /sha256/);

execFileSync(process.execPath, ['--check', 'public/brand-image-search-v70.js'], { stdio: 'pipe' });

console.log('QA pesquisa de imagens das marcas V70: OK');

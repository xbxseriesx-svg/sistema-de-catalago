import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [index, uiV70, uiV72, workerV71, workerV72, workerV70, wrangler, version] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/brand-image-search-v70.js', 'utf8'),
  readFile('public/brand-image-search-v72.js', 'utf8'),
  readFile('worker/index-v71.ts', 'utf8'),
  readFile('worker/index-v72.ts', 'utf8'),
  readFile('worker/index-v70.ts', 'utf8'),
  readFile('wrangler.jsonc', 'utf8'),
  readFile('VERSION', 'utf8').then((value) => value.trim()),
]);

assert.ok(Number(version) >= 70, 'A pesquisa de imagens das marcas exige V70 ou superior.');
assert.match(index, /brand-image-search-v70\.js\?v=72/, 'Editor não carrega a interface base da pesquisa com cache V72.');
assert.match(index, /brand-image-search-v72\.js\?v=72/, 'Editor não carrega o complemento da pesquisa V72.');
assert.match(wrangler, /"main":\s*"worker\/index-v71\.ts"/, 'Wrangler precisa apontar para a entrada V71.');
assert.match(workerV71, /import worker from '\.\/index-v72'/, 'Entrada V71 não encaminha para V72.');
assert.match(uiV70, /data-asteryon-brand-image-search/);
assert.match(uiV70, /Pesquisar imagem da marca/);
assert.match(uiV70, /\/api\/admin\/brands/);
assert.match(uiV70, /\/api\/admin\/brand-images\/search/);
assert.match(uiV70, /\/api\/admin\/brand-images\/fetch/);
assert.match(uiV70, /\/api\/admin\/brand-images\/upload/);
assert.match(uiV70, /image\/webp/);
assert.match(uiV70, /createImageBitmap/);
assert.match(uiV70, /MutationObserver/);
assert.match(uiV72, /Google Imagens/);
assert.match(uiV72, /google\.com\/search\?tbm=isch/);
assert.match(workerV72, /duckduckgoImageSearch/);
assert.match(workerV72, /duckduckgo\.com\/i\.js/);
assert.match(workerV72, /googleSearchUrl/);
assert.match(workerV72, /Pesquisa ampla da web|pesquisa ampla da web/i);
assert.match(workerV72, /ASTERYON-Catalog\/2\.1\.72/);
assert.match(workerV70, /\/api\/admin\/brand-images\/fetch/);
assert.match(workerV70, /\/api\/admin\/brand-images\/upload/);
assert.match(workerV70, /BRAND_BUCKET\s*=\s*'brand-media'/);
assert.match(workerV70, /sha256/);

execFileSync(process.execPath, ['--check', 'public/brand-image-search-v70.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/brand-image-search-v72.js'], { stdio: 'pipe' });

console.log('QA pesquisa de imagens das marcas V72: OK (pesquisa ampla da web + Google Imagens + gravação V70)');

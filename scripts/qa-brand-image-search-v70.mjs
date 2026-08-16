import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [index, uiV70, uiV72, pickerHtml, pickerJs, workerV81, workerV71, workerV72, workerV70, wrangler, version] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/brand-image-search-v70.js', 'utf8'),
  readFile('public/brand-image-search-v72.js', 'utf8'),
  readFile('public/google-image-picker-v73.html', 'utf8'),
  readFile('public/google-image-picker-v73.js', 'utf8'),
  readFile('worker/index-v81.ts', 'utf8'),
  readFile('worker/index-v71.ts', 'utf8'),
  readFile('worker/index-v72.ts', 'utf8'),
  readFile('worker/index-v70.ts', 'utf8'),
  readFile('wrangler.jsonc', 'utf8'),
  readFile('VERSION', 'utf8').then((value) => value.trim()),
]);

assert.ok(Number(version) >= 70, 'A pesquisa de imagens das marcas exige V70 ou superior.');
assert.match(index, /brand-image-search-v70\.js\?v=81/, 'Editor não carrega a interface base da pesquisa com cache da release V81.');
assert.match(index, /brand-image-search-v72\.js\?v=81/, 'Editor não carrega o isolamento de marcas com cache da release V81.');
assert.match(wrangler, /"main":\s*"worker\/index-v81\.ts"/, 'Wrangler precisa apontar para a entrada auditada V81.');
assert.match(workerV81, /import worker from '\.\/index-v71'/, 'V81 precisa preservar a cadeia V71/V72/V70.');
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

assert.match(uiV72, /Pesquisar na web/);
assert.match(uiV72, /Logo manual/);
assert.match(uiV72, /data-asteryon-brand-id-v77/);
assert.match(uiV72, /markActiveContext/);
assert.match(uiV72, /applyLogoOnlyToExactRow/);
assert.match(uiV72, /rows\.length !== 1/);
assert.match(uiV72, /detail\?\.brandId/);
assert.match(uiV72, /openPicker\(modalBrandId\(\), modalBrandName\(\), 'manual'\)/);
assert.match(uiV72, /openPicker\(modalBrandId\(\), modalBrandName\(\), 'web'\)/);
assert.match(uiV72, /google-image-picker-v73\.html\?v=77/);
assert.match(uiV72, /window\.open/);
assert.match(uiV72, /popup=yes/);
assert.match(uiV72, /asteryon:brand-logo-updated/);
assert.doesNotMatch(uiV72, /const brandName = normalize\(detail\.brandName\)/, 'V77 não pode localizar a linha apenas pelo nome da marca.');
assert.doesNotMatch(uiV72, /google\.com\/search\?tbm=isch/, 'O botão integrado não deve sair para google.com.');

assert.match(pickerHtml, /Pesquisa de imagens — ASTERYON/);
assert.match(pickerHtml, /Pesquisar imagem da marca/);
assert.match(pickerHtml, /Enviar logo manualmente/);
assert.match(pickerHtml, /accept="image\/png,image\/jpeg,image\/webp"/);
assert.match(pickerHtml, /google-image-picker-v73\.js\?v=76/);
assert.match(pickerJs, /\/api\/admin\/brand-images\/search\?brandId=/);
assert.match(pickerJs, /\/api\/admin\/brand-images\/fetch/);
assert.match(pickerJs, /\/api\/admin\/brand-images\/upload/);
assert.match(pickerJs, /image\/webp/);
assert.match(pickerJs, /convertToWebp/);
assert.match(pickerJs, /chooseManualFile/);
assert.match(pickerJs, /['"]manual['"]/);
assert.match(pickerJs, /MAX_SOURCE_BYTES/);
assert.match(pickerJs, /Usar esta imagem/);
assert.match(pickerJs, /Pesquisa na web/);
assert.match(pickerJs, /BroadcastChannel/);
assert.match(pickerJs, /window\.opener\.postMessage/);
assert.doesNotMatch(pickerJs, /provider=google/, 'O seletor V76 não pode forçar a API Google indisponível.');
assert.doesNotMatch(pickerJs, /image_gen|generate|gerar imagem/i, 'O seletor não pode conter fluxo de geração de imagem.');

assert.match(workerV72, /googleImageSearch/);
assert.match(workerV72, /customsearch\.googleapis\.com\/customsearch\/v1/);
assert.match(workerV72, /duckduckgoImageSearch/);
assert.match(workerV72, /broadWebSearch/);
assert.match(workerV72, /ASTERYON-Catalog\/2\.1\.72/);
assert.match(workerV70, /\/api\/admin\/brand-images\/fetch/);
assert.match(workerV70, /\/api\/admin\/brand-images\/upload/);
assert.match(workerV70, /BRAND_BUCKET\s*=\s*'brand-media'/);
assert.match(workerV70, /sha256/);

execFileSync(process.execPath, ['--check', 'public/brand-image-search-v70.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/brand-image-search-v72.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/google-image-picker-v73.js'], { stdio: 'pipe' });

console.log('QA pesquisa de imagens V77+V81: OK (brandId isolado + pesquisa web + upload manual + WEBP, sem propagação entre marcas)');

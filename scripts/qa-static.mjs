import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const html = await readFile('public/index.html', 'utf8');
const bundlePath = html.match(/src="\/(assets\/index-[^"]+\.js)"/)?.[1];
assert.ok(bundlePath, 'o HTML precisa apontar para o bundle JavaScript versionado');

const [css, responsiveCss, responsiveJs, bundle, marketingHotfix, systemRuntimeV80, baseWorker, workerV62, pkg, imageImporter, importProgress, productModalV66, previewV69, previewCssV69, versionText] = await Promise.all([
  readFile('public/editor-overflow-fix.css', 'utf8'),
  readFile('public/responsive-v67.css', 'utf8'),
  readFile('public/responsive-v67.js', 'utf8'),
  readFile(`public/${bundlePath}`, 'utf8'),
  readFile('public/marketing-canvas-hotfix.js', 'utf8'),
  readFile('public/system-runtime-v80.js', 'utf8'),
  readFile('worker/index.ts', 'utf8'),
  readFile('worker/index-v62.ts', 'utf8'),
  readFile('package.json', 'utf8'),
  readFile('public/importar-imagens.html', 'utf8'),
  readFile('public/import-progress-v62.js', 'utf8'),
  readFile('public/product-modal-v66.js', 'utf8'),
  readFile('public/template-preview-v69.js', 'utf8'),
  readFile('public/template-preview-v69.css', 'utf8'),
  readFile('VERSION', 'utf8'),
]);

const version = Number(versionText.trim());
assert.equal(version, 80, 'QA estático desta branch exige V80.');
assert.match(html, /lang="pt-BR"/);
assert.match(html, /viewport-fit=cover/);
assert.match(html, /ASTERYON Editor V80/);
assert.match(html, /editor-overflow-fix\.css\?v=70/);
assert.match(html, /responsive-v67\.css\?v=70/);
assert.match(html, /responsive-v67\.js\?v=70/);
assert.match(html, /template-preview-v69\.css\?v=70/);
assert.match(html, /template-preview-v69\.js\?v=70/);
assert.match(html, /product-modal-v66\.js/);
assert.match(html, /import-progress-v62\.js/);
assert.match(html, /system-runtime-v80\.js\?v=80/);
assert.doesNotMatch(html, /marketing-panel-scope-v79\.js/);
assert.match(css, /min-height:\s*0/);
assert.match(css, /overflow-y:\s*auto/);
assert.match(css, /scrollbar-gutter:\s*stable/);
assert.match(css, /data-asteryon-product-modal-panel/);
assert.match(productModalV66, /MutationObserver/);
assert.match(responsiveCss, /data-asteryon-device="desktop"/);
assert.match(responsiveCss, /data-asteryon-device="tablet"/);
assert.match(responsiveCss, /data-asteryon-device="mobile"/);
assert.match(responsiveCss, /data-asteryon-orientation="landscape"/);
assert.match(responsiveCss, /grid-template-columns/);
assert.match(responsiveCss, /clamp\(/);
assert.match(responsiveCss, /100dvh/);
assert.match(responsiveCss, /overflow-x:\s*hidden/);
assert.match(responsiveJs, /visualViewport/);
assert.match(responsiveJs, /orientationchange/);
assert.match(responsiveJs, /asteryon:viewport-change/);
assert.match(responsiveJs, /MutationObserver/);
assert.match(responsiveJs, /data-asteryon-mobile-toolbar/);
assert.match(bundle, /window\.addEventListener\("orientationchange",r\)/, 'Renderer público não monitora orientação.');
assert.match(bundle, /window\.visualViewport\?\.addEventListener\("resize",r\)/, 'Renderer público não monitora visualViewport.');
assert.match(bundle, /const n=xt\(e,a\),i=t\/Math\.max\(1,n\.width\)/, 'Renderer público não aproveita toda a largura disponível.');
assert.match(bundle, /LAURENCINI_BRAND/, 'Bundle não contém a normalização de marca V68+.');
assert.doesNotMatch(bundle, /Cloudflare D1|D1 conectado|D1 sincronizado|Conectando ao ASTERYON D1/);
assert.match(bundle, /Supabase Postgres/);
assert.match(bundle, /Supabase conectado/);
assert.match(bundle, /descricao do departamento/);
assert.match(bundle, /descricao da secao/);
assert.match(bundle, /nome da categoria/);
assert.match(bundle, /sourceColumns/);
assert.match(bundle, /Sem categoria/);
assert.match(bundle, /href:"\/importar-imagens\.html"/);
assert.match(bundle, /Planilha importa os dados dos produtos\. Imagens abre o importador V62 em lote/);
assert.match(bundle, /asteryon:import-progress/);
assert.match(imageImporter, /Selecionar pasta de imagens/);
assert.match(imageImporter, /webkitdirectory/);
assert.match(imageImporter, /Converter e importar imagens encontradas/);
assert.match(imageImporter, /Supabase Storage/);
assert.match(imageImporter, /responsive-v67\.css/);
assert.match(imageImporter, /responsive-v67\.js/);
assert.match(importProgress, /Arquivos em processamento/);
assert.match(importProgress, /asteryon:import-progress/);
assert.match(html, /marketing-canvas-hotfix\.js/);
assert.match(marketingHotfix, /data-marketing-hotfix/);
assert.match(marketingHotfix, /data-marketing-drag-handle/);
assert.match(marketingHotfix, /data-marketing-resize/);
assert.match(marketingHotfix, /\/api\/admin\/marketing/);
assert.match(marketingHotfix, /Excluir todo o marketing/);
assert.match(systemRuntimeV80, /data-asteryon-v80-links-context/);
assert.match(systemRuntimeV80, /isolateNestedPanel/);
assert.match(systemRuntimeV80, /hideDuplicateImporter/);
assert.match(baseWorker, /tableAll\(env, 'products'/);
assert.match(baseWorker, /seenCodes/);
assert.match(baseWorker, /select=theme,banner,video_banner,carousel,settings/);
assert.match(baseWorker, /marketingLayout/);
assert.match(baseWorker, /path === '\/api\/public\/catalog'/);
assert.doesNotMatch(baseWorker, /departamento_id: 'dep_atacado'/);
assert.match(workerV62, /database: 'Supabase Postgres'/);
assert.match(workerV62, /storage: 'Supabase Storage'/);
assert.match(workerV62, /d1: false/);
assert.match(previewV69, /\/api\/public\/catalog/);
assert.match(previewV69, /Pré-visualizar modelo completo/);
assert.match(previewV69, /Aplicar este modelo/);
assert.match(previewV69, /MutationObserver/);
assert.doesNotMatch(previewV69, /\/api\/admin\//);
assert.match(previewCssV69, /ltp-products/);
assert.match(previewCssV69, /ltp-brand-grid/);
assert.match(previewCssV69, /@media \(max-width:720px\)/);
const packageJson = JSON.parse(pkg);
assert.equal(packageJson.version, '2.1.80');
assert.equal(packageJson.scripts['prepare:bundle'], 'node scripts/patch-importer-v60.mjs && node scripts/patch-editor-menu-v64.mjs && node scripts/patch-catalog-modal-v65.mjs && node scripts/patch-responsive-v67.mjs && node scripts/patch-brand-laurencini-v68.mjs');
assert.match(packageJson.scripts.test, /qa-template-preview-v69\.mjs/);
assert.match(packageJson.scripts.test, /qa-system-v80\.mjs/);

execFileSync(process.execPath, ['--check', `public/${bundlePath}`], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/marketing-canvas-hotfix.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/system-runtime-v80.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/import-progress-v62.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/product-modal-v66.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/responsive-v67.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/template-preview-v69.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'scripts/patch-brand-laurencini-v68.mjs'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'scripts/qa-template-preview-v69.mjs'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'scripts/qa-system-v80.mjs'], { stdio: 'pipe' });

console.log('QA estático da V80: OK');

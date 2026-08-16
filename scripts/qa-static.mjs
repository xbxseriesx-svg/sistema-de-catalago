import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const html = await readFile('public/index.html', 'utf8');
const bundlePath = html.match(/src="\/(assets\/index-[^"]+\.js)"/)?.[1];
assert.ok(bundlePath, 'o HTML precisa apontar para o bundle JavaScript versionado');

const [css, bundle, marketingHotfix, worker, pkg] = await Promise.all([
  readFile('public/editor-overflow-fix.css', 'utf8'),
  readFile(`public/${bundlePath}`, 'utf8'),
  readFile('public/marketing-canvas-hotfix.js', 'utf8'),
  readFile('worker/index.ts', 'utf8'),
  readFile('package.json', 'utf8'),
]);

assert.match(html, /lang="pt-BR"/);
assert.match(html, /editor-overflow-fix\.css/);
assert.match(css, /min-height:\s*0/);
assert.match(css, /overflow-y:\s*auto/);
assert.match(css, /scrollbar-gutter:\s*stable/);
assert.doesNotMatch(bundle, /Cloudflare D1|D1 conectado|D1 sincronizado/);
assert.match(bundle, /Supabase Postgres/);
assert.match(bundle, /Supabase conectado/);
assert.match(bundle, /descricao do departamento/);
assert.match(bundle, /descricao da secao/);
assert.match(bundle, /nome da categoria/);
assert.match(bundle, /sourceColumns/);
assert.match(bundle, /Sem categoria/);
assert.match(html, /marketing-canvas-hotfix\.js/);
assert.match(marketingHotfix, /data-marketing-hotfix/);
assert.match(marketingHotfix, /data-marketing-drag-handle/);
assert.match(marketingHotfix, /data-marketing-resize/);
assert.match(marketingHotfix, /\/api\/admin\/marketing/);
assert.match(marketingHotfix, /Excluir todo o marketing/);
assert.match(worker, /tableAll\(env, 'products'/);
assert.match(worker, /seenCodes/);
assert.match(worker, /select=theme,banner,video_banner,carousel,settings/);
assert.match(worker, /marketingLayout/);
assert.doesNotMatch(worker, /departamento_id: 'dep_atacado'/);
assert.equal(JSON.parse(pkg).version, '2.1.60');

execFileSync(process.execPath, ['--check', `public/${bundlePath}`], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/marketing-canvas-hotfix.js'], { stdio: 'pipe' });

console.log('QA estático da V60: OK');

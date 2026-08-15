import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile('public/index.html', 'utf8');
const bundlePath = html.match(/src="\/(assets\/index-[^"]+\.js)"/)?.[1];
assert.ok(bundlePath, 'o HTML precisa apontar para o bundle JavaScript versionado');

const [css, bundle, worker, pkg] = await Promise.all([
  readFile('public/editor-overflow-fix.css', 'utf8'),
  readFile(`public/${bundlePath}`, 'utf8'),
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
assert.match(bundle, /data-marketing-canvas-element/);
assert.match(bundle, /data-marketing-drag-handle/);
assert.match(bundle, /data-marketing-resize/);
assert.match(bundle, /Posição e tamanho no canvas/);
assert.match(bundle, /Excluir carrossel completo/);
assert.match(bundle, /asteryon:open-marketing/);
assert.doesNotMatch(bundle, /Marketing visível no modo de edição/);
assert.match(worker, /tableAll\(env, 'products'/);
assert.match(worker, /seenCodes/);
assert.match(worker, /select=theme,banner,video_banner,carousel,settings/);
assert.match(worker, /marketingLayout/);
assert.doesNotMatch(worker, /departamento_id: 'dep_atacado'/);
assert.equal(JSON.parse(pkg).version, '2.1.58');

console.log('QA estático da V58: OK');

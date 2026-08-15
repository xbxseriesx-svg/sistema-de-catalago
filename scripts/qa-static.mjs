import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, bundle, worker, pkg] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/editor-overflow-fix.css', 'utf8'),
  readFile('public/assets/index-_J4BqdfT.js', 'utf8'),
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
assert.match(worker, /tableAll\(env, 'products'/);
assert.match(worker, /seenCodes/);
assert.doesNotMatch(worker, /departamento_id: 'dep_atacado'/);
assert.equal(JSON.parse(pkg).version, '2.1.58');

console.log('QA estático da V58: OK');

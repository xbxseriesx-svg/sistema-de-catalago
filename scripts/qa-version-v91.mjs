import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [version, packageText, lockText, worker, readme, wrangler, html, loader] = await Promise.all([
  readFile('VERSION', 'utf8').then((value) => value.trim()),
  readFile('package.json', 'utf8'),
  readFile('package-lock.json', 'utf8'),
  readFile('worker/index-v81.ts', 'utf8'),
  readFile('README.md', 'utf8'),
  readFile('wrangler.jsonc', 'utf8'),
  readFile('public/index.html', 'utf8'),
  readFile('public/runtime-loader-v87.js', 'utf8'),
]);

const pkg = JSON.parse(packageText);
const lock = JSON.parse(lockText);

assert.equal(version, '91', 'VERSION deve representar a release lógica V91');
assert.equal(pkg.version, '2.1.91', 'package.json deve representar a release lógica 2.1.91');
assert.equal(lock.version, '2.1.91', 'package-lock.json deve acompanhar package.json');
assert.equal(lock.packages?.['']?.version, '2.1.91', 'pacote raiz do lockfile deve acompanhar package.json');
assert.match(worker, /version:\s*['"]V91['"]/, '/api/health deve responder V91');
assert.match(readme, /^# ASTERYON Catálogo — V91/m, 'README deve identificar V91 como release atual');
assert.match(readme, /Entry point:\s*`worker\/index-v81\.ts`/, 'README deve citar o entrypoint físico atual');
assert.match(readme, /Versão da aplicação:\s*`2\.1\.91`/, 'README deve citar 2.1.91');
assert.match(wrangler, /"main":\s*"worker\/index-v81\.ts"/, 'Wrangler deve continuar apontando para o entrypoint auditado');
assert.match(html, /<title>ASTERYON Editor V91<\/title>/, 'HTML publicado deve identificar V91');
assert.match(html, /preview-editor-v91-core\.js\?v=91/, 'scripts V91 precisam usar cache key V91');
assert.doesNotMatch(html, /\?v=89(?:[&"'])/, 'HTML não pode manter cache key V89');
assert.doesNotMatch(loader, /\?v=89(?:[&'"`])/, 'runtime loader não pode reinjetar cache key V89');

console.log('QA V91 versionamento: VERSION, package, lock, health, README, cache e entrypoint estão coerentes.');

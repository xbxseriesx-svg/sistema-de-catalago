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

assert.equal(version, '92', 'VERSION deve representar a release lógica V92');
assert.equal(pkg.version, '2.1.92', 'package.json deve representar a release lógica 2.1.92');
assert.equal(lock.version, '2.1.92', 'package-lock.json deve acompanhar package.json');
assert.equal(lock.packages?.['']?.version, '2.1.92', 'pacote raiz do lockfile deve acompanhar package.json');
assert.match(worker, /version:\s*['"]V92['"]/, '/api/health deve responder V92');
assert.match(readme, /^# ASTERYON Catálogo — V92/m, 'README deve identificar V92 como release atual');
assert.match(readme, /Versão da aplicação:\s*`2\.1\.92`/, 'README deve citar 2.1.92');
assert.match(readme, /Equipe 4/, 'README deve registrar o quarto gate de auditoria.');
assert.match(wrangler, /"main":\s*"worker\/index-v81\.ts"/, 'Wrangler deve continuar apontando para o entrypoint auditado');
assert.match(html, /<title>ASTERYON Editor V92<\/title>/, 'HTML publicado deve identificar V92');
assert.match(html, /preview-editor-v91-core\.js\?v=92/, 'camadas físicas V91 precisam receber cache key V92 após o hotfix');
assert.match(html, /preview-editor-v92-team4\.js\?v=92/, 'Equipe 4 precisa ser publicada com cache V92');
assert.doesNotMatch(html, /\?v=91(?:[&"'])/, 'HTML não pode manter cache key V91 após a release V92');
assert.doesNotMatch(loader, /\?v=91(?:[&'"`])/, 'runtime loader não pode reinjetar cache key V91');

console.log('QA V92 versionamento: VERSION, package, lock, health, README, cache e Equipe 4 estão coerentes.');

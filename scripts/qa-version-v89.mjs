import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [version, packageText, worker, readme, wrangler] = await Promise.all([
  readFile('VERSION', 'utf8').then((value) => value.trim()),
  readFile('package.json', 'utf8'),
  readFile('worker/index-v81.ts', 'utf8'),
  readFile('README.md', 'utf8'),
  readFile('wrangler.jsonc', 'utf8'),
]);
const pkg = JSON.parse(packageText);

assert.equal(version, '89', 'VERSION deve representar a release lógica V89');
assert.equal(pkg.version, '2.1.89', 'package.json deve representar a release lógica 2.1.89');
assert.match(worker, /version:\s*['"]V89['"]/, '/api/health deve responder V89');
assert.match(readme, /^# ASTERYON Catálogo — V89/m, 'README deve identificar V89 como release atual');
assert.match(readme, /Entry point:\s*`worker\/index-v81\.ts`/, 'README deve citar o entrypoint físico atual');
assert.match(readme, /Versão da aplicação:\s*`2\.1\.89`/, 'README deve citar 2.1.89');
assert.match(wrangler, /"main":\s*"worker\/index-v81\.ts"/, 'Wrangler deve continuar apontando para o entrypoint auditado');

console.log('QA V89 versionamento: VERSION, package, health, README e entrypoint estão coerentes.');

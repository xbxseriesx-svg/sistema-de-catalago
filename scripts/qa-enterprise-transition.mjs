import { existsSync, readFileSync, readdirSync } from 'node:fs';

const fail = (message) => { throw new Error(`ENTERPRISE FINAL: ${message}`); };
const ok = (message) => console.log(`ENTERPRISE FINAL OK: ${message}`);

for (const file of [
  'docs/ENTERPRISE_6_TEAMS_GOVERNANCE.md',
  'docs/TEAM0_DISCOVERY_ENTERPRISE_2026-08-20.md',
  'docs/ENTERPRISE_FINAL_CLEANUP_2026-08-21.md',
]) {
  if (!existsSync(file) || readFileSync(file, 'utf8').trim().length < 500) fail(`documentação obrigatória ausente/incompleta: ${file}`);
}

const version = readFileSync('VERSION', 'utf8').trim();
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (String(pkg.version || '').split('.').at(-1) !== version) fail('VERSION diverge de package.json.');
if (!String(pkg.scripts?.['prepare:release'] || '').includes('prepare:frontend')) fail('prepare:release não constrói o frontend oficial.');
if (pkg.scripts?.['prepare:rollback'] || pkg.scripts?.['prepare:bundle']) fail('candidato ainda contém script de rollback/bundle histórico.');
if (/prepare:rollback|prepare-bundle-v|\.\/public\b|wrangler\.legacy-rollback/i.test(String(pkg.scripts?.test || ''))) fail('regressão oficial ainda depende do runtime legado.');

const wrangler = readFileSync('wrangler.jsonc', 'utf8');
if (!wrangler.includes('"main": "worker/app/index.ts"')) fail('Wrangler não aponta para worker/app/index.ts.');
if (!wrangler.includes('"directory": "./frontend/dist"')) fail('Wrangler não serve frontend/dist.');
if (/\bD1\b|d1_databases|\bR2\b|r2_buckets/.test(wrangler)) fail('Wrangler reintroduziu D1/R2.');

for (const path of [
  'public',
  'wrangler.legacy-rollback.jsonc',
  'wrangler.enterprise.jsonc',
  'worker/index.ts',
  'worker/modules',
  'worker/auth-account-v89.ts',
  'worker/crypto-buffer-v70.d.ts',
  'scripts/prepare-bundle-v81.mjs',
  'scripts/modelo-oficial.mjs',
]) {
  if (existsSync(path)) fail(`resíduo físico legado ainda presente: ${path}`);
}

const workerEntries = readdirSync('worker', { withFileTypes: true });
if (workerEntries.some((entry) => /^index-v\d+\.ts$/.test(entry.name))) fail('Worker versionado ainda existe no candidato.');
if (workerEntries.some((entry) => entry.name !== 'app')) fail(`worker/ deve conter apenas app/: ${workerEntries.map((e) => e.name).join(', ')}`);

for (const name of readdirSync('scripts')) {
  if (/^patch-|^prepare-bundle-|^diagnose-v|^sync-release-metadata-v|^serve-e2e-static-v|^v\d+-.*\.txt$|^qa-.*-v\d+\.mjs$/i.test(name)) fail(`script histórico ainda presente: scripts/${name}`);
}

const workflows = readdirSync('.github/workflows');
for (const name of workflows) if (/v\d+/i.test(name)) fail(`workflow versionado/duplicado ainda presente: ${name}`);
if (!workflows.includes('enterprise-six-teams.yml') || !workflows.includes('enterprise-frontend-lockfile.yml')) fail('workflows Enterprise finais ausentes.');

for (const name of readdirSync('tests/e2e')) if (/-v\d+/i.test(name)) fail(`E2E ainda usa nome de release histórica: ${name}`);

const workflow = readFileSync('.github/workflows/enterprise-six-teams.yml', 'utf8');
if (!workflow.includes('github.event.pull_request.base.sha')) fail('rollback externo não está fixado ao SHA-base da PR.');
if (!workflow.includes('path: _rollback-v94')) fail('rollback não é validado em checkout isolado.');
if (!workflow.includes('npm run prepare:bundle')) fail('workflow não comprova a construção do baseline histórico em checkout isolado.');
if (!workflow.includes('tests/e2e/import-products-enterprise.spec.mjs')) fail('auditoria independente não repete importação XLSX Enterprise.');

ok(`release ${version}: candidato sem runtime/build legado; rollback preservado externamente pelo SHA-base.`);
console.log('ENTERPRISE FINAL CLEANUP APROVADO.');

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const fail = (message) => { throw new Error(`ENTERPRISE COMPAT: ${message}`); };
const ok = (message) => console.log(`ENTERPRISE COMPAT OK: ${message}`);

const VERIFIED_PRODUCTION_BASE = '6b07df6c8e07ff50c20dc32eb96d2f0a4ff0e657';
const VERIFIED_INDEX_BLOB = '2ce65e5c554468c7e87abd4329a1988a1860c3e7';
const VERIFIED_BUNDLE_BLOB = '06da9251f10658ea1a7d1abe28333a7d48817bde';

function gitBlobSha(path) {
  const content = readFileSync(path);
  const header = Buffer.from(`blob ${content.length}\0`);
  return createHash('sha1').update(header).update(content).digest('hex');
}

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
if (!String(pkg.scripts?.['prepare:release'] || '').includes('prepare:frontend')) fail('prepare:release deixou de reconstruir a fonte Enterprise para regressão.');
if (pkg.scripts?.['prepare:rollback'] || pkg.scripts?.['prepare:bundle']) fail('candidato atual não deve carregar script de rollback/bundle histórico.');

const wrangler = readFileSync('wrangler.jsonc', 'utf8');
if (!wrangler.includes('"main": "worker/app/index.ts"')) fail('Wrangler não aponta para worker/app/index.ts.');
if (!wrangler.includes('"directory": "./public"')) fail('Wrangler não serve a UI V94 de compatibilidade restaurada em public/.');
if (wrangler.includes('"directory": "./frontend/dist"')) fail('produção voltou a apontar para o SPA Enterprise que trocou as rotas visuais.');
if (!wrangler.includes('"run_worker_first": ["/api/*"]')) fail('Worker não intercepta /api/* antes dos assets.');
if (/\bD1\b|d1_databases|\bR2\b|r2_buckets/.test(wrangler)) fail('Wrangler reintroduziu D1/R2.');

for (const path of [
  'public/index.html',
  'public/assets/index-V60Excel.js',
  'public/editor-runtime-v87.js',
  'public/runtime-loader-v87.js',
  'public/responsive-v67.css',
]) {
  if (!existsSync(path)) fail(`asset V94 de compatibilidade ausente: ${path}`);
}
if (gitBlobSha('public/index.html') !== VERIFIED_INDEX_BLOB) fail('public/index.html divergiu do production V94 verificado.');
if (gitBlobSha('public/assets/index-V60Excel.js') !== VERIFIED_BUNDLE_BLOB) fail('bundle principal V94 divergiu do production verificado.');
const publicIndex = readFileSync('public/index.html', 'utf8');
for (const marker of ['ASTERYON Editor V94', 'index-V60Excel.js?v=94', 'preview-editor-v93-source.js?v=94']) {
  if (!publicIndex.includes(marker)) fail(`public/index.html perdeu marcador obrigatório: ${marker}`);
}

for (const path of [
  'wrangler.legacy-rollback.jsonc',
  'wrangler.enterprise.jsonc',
  'worker/index.ts',
  'worker/modules',
  'worker/auth-account-v89.ts',
  'worker/crypto-buffer-v70.d.ts',
  'scripts/prepare-bundle-v81.mjs',
  'scripts/modelo-oficial.mjs',
]) {
  if (existsSync(path)) fail(`runtime/backend legado indevido ainda presente: ${path}`);
}

const workerEntries = readdirSync('worker', { withFileTypes: true });
if (workerEntries.some((entry) => /^index-v\d+\.ts$/.test(entry.name))) fail('Worker versionado ainda existe no candidato.');
if (workerEntries.some((entry) => entry.name !== 'app')) fail(`worker/ deve conter apenas app/: ${workerEntries.map((e) => e.name).join(', ')}`);

for (const name of readdirSync('scripts')) {
  if (/^patch-|^prepare-bundle-|^diagnose-v|^sync-release-metadata-v|^serve-e2e-static-v|^v\d+-.*\.txt$|^qa-.*-v\d+\.mjs$/i.test(name)) fail(`script histórico indevido ainda presente: scripts/${name}`);
}

const workflows = readdirSync('.github/workflows');
for (const name of workflows) if (/v\d+/i.test(name)) fail(`workflow versionado/duplicado ainda presente: ${name}`);
if (!workflows.includes('enterprise-six-teams.yml') || !workflows.includes('enterprise-frontend-lockfile.yml')) fail('workflows Enterprise finais ausentes.');

for (const name of readdirSync('tests/e2e')) if (/-v\d+/i.test(name)) fail(`E2E ainda usa nome de release histórica: ${name}`);

const workflow = readFileSync('.github/workflows/enterprise-six-teams.yml', 'utf8');
if (!workflow.includes(`ref: ${VERIFIED_PRODUCTION_BASE}`)) fail('rollback externo não está fixado ao último production V94 verificado.');
if (!workflow.includes('path: _rollback-v94')) fail('rollback não é validado em checkout isolado.');
if (!workflow.includes('npm run prepare:bundle')) fail('workflow não comprova a construção do baseline histórico em checkout isolado.');
if (!workflow.includes('playwright.production-compat.config.mjs')) fail('homologação não testa a UI realmente servida em public/.');
if (!workflow.includes('tests/e2e/import-products-enterprise.spec.mjs')) fail('auditoria independente não preserva a regressão XLSX da fonte Enterprise.');

ok(`release ${version}: UI V94 verificada restaurada em public/, Worker modular preservado e rollback fixado em ${VERIFIED_PRODUCTION_BASE}.`);
console.log('ENTERPRISE PRODUCTION COMPATIBILITY APROVADA.');

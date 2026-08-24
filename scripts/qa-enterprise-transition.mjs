import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const fail = (message) => { throw new Error(`ENTERPRISE COMPAT: ${message}`); };
const ok = (message) => console.log(`ENTERPRISE COMPAT OK: ${message}`);

const VERIFIED_PRODUCTION_BASE = '6b07df6c8e07ff50c20dc32eb96d2f0a4ff0e657';
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
if (version !== '95') fail(`release atual deveria ser 95, recebido ${version || 'vazio'}.`);

const wrangler = readFileSync('wrangler.jsonc', 'utf8');
if (!wrangler.includes('"main": "worker/app/index.ts"')) fail('Wrangler não aponta para worker/app/index.ts.');
if (!wrangler.includes('"directory": "./public"')) fail('Wrangler não serve a UI V95 em public/.');
if (wrangler.includes('"directory": "./frontend/dist"')) fail('produção voltou a apontar para o SPA Enterprise que trocou as rotas visuais.');
if (!wrangler.includes('"run_worker_first": ["/api/*"]')) fail('Worker não intercepta /api/* antes dos assets.');
if (/\bD1\b|d1_databases|\bR2\b|r2_buckets/.test(wrangler)) fail('Wrangler reintroduziu D1/R2.');

for (const path of [
  'public/index.html',
  'public/assets/index-V60Excel.js',
  'public/editor-runtime-v87.js',
  'public/runtime-loader-v87.js',
  'public/responsive-v67.css',
  'public/responsive-auto-v95.js',
  'public/commercial-segments-v95.js',
  'public/commercial-segments-destination-v95.js',
  'public/public-commercial-segment-popup-v95.js',
]) {
  if (!existsSync(path)) fail(`asset obrigatório da release V95 ausente: ${path}`);
}

// O bundle legado validado continua imutável; a evolução V95 entra por camadas adicionais e pelo Worker modular.
if (gitBlobSha('public/assets/index-V60Excel.js') !== VERIFIED_BUNDLE_BLOB) fail('bundle principal de compatibilidade divergiu do production V94 verificado.');
const publicIndex = readFileSync('public/index.html', 'utf8');
for (const marker of [
  'ASTERYON Editor V95',
  'index-V60Excel.js?v=95',
  'preview-editor-v93-source.js?v=95',
  'responsive-auto-v95.js?v=95.3',
  'commercial-segments-v95.js?v=95',
  'commercial-segments-destination-v95.js?v=95.1',
]) {
  if (!publicIndex.includes(marker)) fail(`public/index.html perdeu marcador obrigatório V95: ${marker}`);
}
const coreIndex = publicIndex.indexOf('preview-editor-v91-core.js?v=95');
const autoResponsiveIndex = publicIndex.indexOf('responsive-auto-v95.js?v=95.3');
const previewSourceIndex = publicIndex.indexOf('preview-editor-v93-source.js?v=95');
if (!(coreIndex >= 0 && autoResponsiveIndex > coreIndex && previewSourceIndex > autoResponsiveIndex)) {
  fail('motor responsivo automático precisa carregar após o core e antes da captura V93.');
}
const baseSegmentIndex = publicIndex.indexOf('commercial-segments-v95.js?v=95');
const destinationSegmentIndex = publicIndex.indexOf('commercial-segments-destination-v95.js?v=95.1');
const bundleIndex = publicIndex.indexOf('index-V60Excel.js?v=95');
if (!(baseSegmentIndex >= 0 && destinationSegmentIndex > baseSegmentIndex && bundleIndex > destinationSegmentIndex)) {
  fail('integração do destino Segmento comercial precisa carregar após a camada V95 e antes do bundle principal.');
}

const autoResponsive = readFileSync('public/responsive-auto-v95.js', 'utf8');
for (const marker of [
  "const VERSION = '95.3'",
  'DEVICES = Object.freeze({ tablet: 834, mobile: 390 })',
  'template-preview-v69.css',
  "window.addEventListener('asteryon:preview-final-copied-v91'",
  'autoResponsiveVersion',
  "autoResponsiveMode = 'css-reflow'",
  'AsteryonResponsiveAuto',
  '/api\\/(?:admin|public)\\/(?:pages|templates)/',
]) {
  if (!autoResponsive.includes(marker)) fail(`motor responsivo automático incompleto: ${marker}`);
}
if (autoResponsive.includes('390 / 1440') || autoResponsive.includes('834 / 1440')) {
  fail('regressão: tablet/mobile não podem voltar à escala matemática fixa do desktop.');
}
if (!autoResponsive.includes('ltp-products') || !autoResponsive.includes('ltp-segments') || !autoResponsive.includes('ltp-story')) {
  fail('motor responsivo não reconhece os grupos estruturais principais do Modelo Oficial.');
}

const commercialDestination = readFileSync('public/commercial-segments-destination-v95.js', 'utf8');
for (const marker of [
  "const ACTION = 'commercial-segment'",
  "const LABEL = 'Segmento comercial'",
  "normalize(element.textContent) === 'tipo de destino'",
  'option.value = ACTION',
  'option.textContent = LABEL',
  'state.actions?.set(nodeId, current)',
  'state.actions.delete(nodeId)',
]) {
  if (!commercialDestination.includes(marker)) fail(`integração visual de segmento comercial incompleta: ${marker}`);
}

const runtimeLoader = readFileSync('public/runtime-loader-v87.js', 'utf8');
if (!runtimeLoader.includes('/public-commercial-segment-popup-v95.js?v=95.2')) {
  fail('runtime público deixou de carregar o popup de segmento comercial V95.2.');
}
const commercialPopup = readFileSync('public/public-commercial-segment-popup-v95.js', 'utf8');
for (const marker of [
  '/api/public/commercial-segments',
  '/products?offset=',
  'data-commercial-segment-action',
  "document.addEventListener('click', intercept, true)",
  'event.stopImmediatePropagation()',
  'asteryon:public-product-popup',
  'AsteryonCommercialSegmentPopup',
]) {
  if (!commercialPopup.includes(marker)) fail(`popup público de segmento comercial incompleto: ${marker}`);
}
if (/\bscore\b/i.test(commercialPopup)) {
  fail('popup público não deve renderizar nem consumir score comercial.');
}

const workerIndex = readFileSync('worker/app/index.ts', 'utf8');
if (!workerIndex.includes("version: 'V95'")) fail('health check do Worker não declara V95.');
if (!workerIndex.includes('handleCommercialSegmentsRoute')) fail('Worker V95 perdeu a rota de segmentação comercial.');

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

ok(`release ${version}: UI V95 validada, reflow automático tablet/mobile V95.3, destino e popup de Segmento comercial integrados, bundle compatível preservado, Worker modular com segmentação comercial e rollback V94 fixado em ${VERIFIED_PRODUCTION_BASE}.`);
console.log('ENTERPRISE PRODUCTION COMPATIBILITY APROVADA.');
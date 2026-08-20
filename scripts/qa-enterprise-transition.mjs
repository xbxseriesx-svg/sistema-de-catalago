import { readFile, readdir } from 'node:fs/promises';
import process from 'node:process';

const fail = (message) => {
  console.error(`ENTERPRISE GATE: ${message}`);
  process.exitCode = 1;
};

const ok = (message) => console.log(`ENTERPRISE GATE OK: ${message}`);

const requiredDocs = [
  'docs/ENTERPRISE_6_TEAMS_GOVERNANCE.md',
  'docs/TEAM0_DISCOVERY_ENTERPRISE_2026-08-20.md',
];

for (const file of requiredDocs) {
  try {
    const content = await readFile(file, 'utf8');
    if (content.trim().length < 500) fail(`${file} existe, mas está incompleto.`);
    else ok(`${file} presente.`);
  } catch {
    fail(`${file} ausente.`);
  }
}

const version = (await readFile('VERSION', 'utf8')).trim();
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const packageRelease = String(pkg.version || '').split('.').at(-1);
if (packageRelease !== version) fail(`VERSION=${version} diverge do patch de package.json=${pkg.version}.`);
else ok(`metadados de release coerentes em ${version}.`);

const wrangler = await readFile('wrangler.jsonc', 'utf8');
if (!wrangler.includes('"SUPABASE_URL"')) fail('wrangler.jsonc sem SUPABASE_URL.');
if (!wrangler.includes('"SUPABASE_PUBLISHABLE_KEY"')) fail('wrangler.jsonc sem SUPABASE_PUBLISHABLE_KEY.');
if (/\bD1\b|d1_databases|\bR2\b|r2_buckets/.test(wrangler)) fail('wrangler.jsonc reintroduziu binding D1/R2 na arquitetura oficial.');
else ok('Wrangler permanece na arquitetura Supabase sem D1/R2.');
if (!wrangler.includes('"main": "worker/app/index.ts"')) fail('wrangler.jsonc ainda não aponta para o entrypoint Enterprise modular.');
else ok('Wrangler oficial aponta para worker/app/index.ts.');

let rollback = '';
try {
  rollback = await readFile('wrangler.legacy-rollback.jsonc', 'utf8');
} catch {
  fail('wrangler.legacy-rollback.jsonc ausente; rollback explícito é obrigatório durante a transição.');
}
if (rollback) {
  if (!rollback.includes('"main": "worker/index-v81.ts"')) fail('rollback legado não aponta para o último Worker oficial anterior.');
  else ok('rollback legado explícito preservado em worker/index-v81.ts.');
  if (/\bD1\b|d1_databases|\bR2\b|r2_buckets/.test(rollback)) fail('rollback reintroduziu binding D1/R2.');
}

// Durante a reconstrução os Workers antigos permanecem somente como baseline/rollback.
// Este gate impede que novas camadas versionadas sejam acrescentadas à dívida existente.
const legacyWorkerBaseline = new Set([
  'index-v61.ts',
  'index-v62.ts',
  'index-v70.ts',
  'index-v71.ts',
  'index-v72.ts',
  'index-v81.ts',
]);
const workerFiles = await readdir('worker');
const versionedWorkers = workerFiles.filter((name) => /^index-v\d+\.ts$/.test(name));
for (const file of versionedWorkers) {
  if (!legacyWorkerBaseline.has(file)) fail(`nova camada Worker versionada proibida: worker/${file}`);
}
for (const file of legacyWorkerBaseline) {
  if (!versionedWorkers.includes(file)) {
    console.log(`ENTERPRISE GATE INFO: ${file} já foi removido da cadeia histórica.`);
  }
}
ok('nenhuma nova camada index-vXX foi adicionada.');

const packageText = await readFile('package.json', 'utf8');
if (/prepare-bundle-v9[5-9]|prepare-bundle-v\d{3,}/.test(packageText)) {
  fail('foi criada nova geração versionada de prepare-bundle; a reconstrução deve migrar para fonte estável sem sufixo de release.');
} else {
  ok('nenhuma nova geração de patch/build versionado foi criada.');
}

if (process.exitCode) {
  console.error('ENTERPRISE GATE REPROVADO.');
  process.exit(process.exitCode);
}
console.log('ENTERPRISE GATE APROVADO PARA A FASE DE TRANSIÇÃO.');

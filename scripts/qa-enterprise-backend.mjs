import { readFile, readdir } from 'node:fs/promises';
import process from 'node:process';

const required = [
  'worker/app/env.ts',
  'worker/app/http.ts',
  'worker/app/domain.ts',
  'worker/app/supabase.ts',
  'worker/app/audit.ts',
  'worker/app/auth/account.ts',
  'worker/app/auth/session.ts',
  'worker/app/services/catalog.ts',
  'worker/app/services/hierarchy.ts',
];

let failed = false;
const fail = (message) => { failed = true; console.error(`ENTERPRISE BACKEND: ${message}`); };
const ok = (message) => console.log(`ENTERPRISE BACKEND OK: ${message}`);

for (const path of required) {
  let source = '';
  try { source = await readFile(path, 'utf8'); } catch { fail(`arquivo obrigatório ausente: ${path}`); continue; }
  if (/from\s+['"][^'"]*index-v\d+/i.test(source)) fail(`${path} importa Worker versionado.`);
  if (/from\s+['"][^'"]*-(?:v|V)\d+/i.test(source)) fail(`${path} importa módulo com sufixo de release.`);
  if (/ASTER_V\d+/i.test(source)) fail(`${path} incorporou marcador histórico de release.`);
}

const appEntries = await readdir('worker/app', { withFileTypes: true });
if (!appEntries.some((entry) => entry.name === 'services' && entry.isDirectory())) fail('worker/app/services ausente.');
if (!appEntries.some((entry) => entry.name === 'auth' && entry.isDirectory())) fail('worker/app/auth ausente.');

const session = await readFile('worker/app/auth/session.ts', 'utf8');
for (const contract of [
  '/api/auth/status',
  '/api/auth/bootstrap',
  '/api/auth/login',
  '/api/auth/logout',
]) {
  if (!session.includes(contract)) fail(`contrato de sessão ausente: ${contract}`);
}

const env = await readFile('worker/app/env.ts', 'utf8');
for (const cookieName of ['__Host-asteryon_access', '__Host-asteryon_refresh']) {
  if (!env.includes(cookieName)) fail(`cookie de sessão ausente: ${cookieName}`);
}

const account = await readFile('worker/app/auth/account.ts', 'utf8');
for (const contract of [
  '/api/auth/account/session',
  '/api/auth/account/recovery',
  '/api/auth/account/password',
]) {
  if (!account.includes(contract)) fail(`contrato de conta ausente: ${contract}`);
}

const catalog = await readFile('worker/app/services/catalog.ts', 'utf8');
for (const contract of [
  '/api/public/catalog',
  '/api/public/brands',
  '/api/public/marketing',
]) {
  if (!catalog.includes(contract)) fail(`contrato público ausente: ${contract}`);
}
if (!/api\\\/public\\\/pages/.test(catalog)) fail('contrato público de páginas ausente.');

const hierarchy = await readFile('worker/app/services/hierarchy.ts', 'utf8');
for (const level of ['departamento', 'secao', 'categoria']) {
  if (!hierarchy.includes(`'${level}'`)) fail(`nível de hierarquia ausente: ${level}`);
}

if (failed) {
  console.error('ENTERPRISE BACKEND REPROVADO.');
  process.exit(1);
}

ok('módulos iniciais independentes da cadeia index-vXX.');
console.log('ENTERPRISE BACKEND APROVADO PARA CONTINUAR A RECONSTRUÇÃO.');

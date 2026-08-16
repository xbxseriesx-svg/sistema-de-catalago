import { readFile, readdir } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [bundle, index, imagePage, progress, wrangler, workerV70, workerV62, version, pkg] = await Promise.all([
  read('public/assets/index-V60Excel.js'),
  read('public/index.html'),
  read('public/importar-imagens.html'),
  read('public/import-progress-v62.js'),
  read('wrangler.jsonc'),
  read('worker/index-v70.ts'),
  read('worker/index-v62.ts'),
  read('VERSION'),
  read('package.json').then(JSON.parse),
]);

const versionNumber = Number(version.trim());
const packagePatch = Number(String(pkg.version).split('.').at(-1));
assert(Number.isFinite(versionNumber) && versionNumber >= 70, 'VERSION precisa ser 70 ou superior nesta release.');
assert(packagePatch === versionNumber, 'package.json precisa acompanhar VERSION.');
assert(wrangler.includes('"main": "worker/index-v70.ts"'), 'Wrangler não aponta para o Worker V70 atual.');
assert(workerV70.includes("import baseWorker from './index-v62'"), 'Worker V70 precisa preservar a base Supabase V62.');
assert(workerV62.includes("database: 'Supabase Postgres'"), 'Health não declara Supabase Postgres.');
assert(workerV62.includes('d1: false'), 'Health precisa declarar d1=false.');
assert(workerV62.includes("storage: 'Supabase Storage'"), 'Health não declara Supabase Storage.');
assert(index.includes('/import-progress-v62.js'), 'Editor não carrega o progresso de importação.');
assert(index.includes(`ASTERYON Editor V${versionNumber}`), 'Título do editor não acompanha VERSION.');
assert(imagePage.includes('/import-progress-v62.js'), 'Importador de imagens não carrega o progresso.');
assert(imagePage.includes('Supabase Storage'), 'Importador de imagens ainda não identifica o Storage correto.');
assert(progress.includes('asteryon:import-progress'), 'Helper de progresso do Excel ausente.');
assert(progress.includes('Arquivos em processamento'), 'Helper de progresso das imagens ausente.');
assert(bundle.includes('asteryon:import-progress'), 'Bundle não emite progresso real do Excel.');
assert(bundle.includes('href:"/importar-imagens.html"'), 'Botão Imagens não está ligado ao importador dedicado.');

const staleUi = [
  'Marketing carregado do D1.',
  'Salvando e validando no D1...',
  'Mídia enviada, vinculada e confirmada no D1.',
  'D1 OK',
  'Conectando ao ASTERYON D1',
  'Destaques do D1',
  'Vitrine automática do D1',
  'Modelo atualizado no D1.',
];
for (const text of staleUi) assert(!bundle.includes(text), `Texto legado encontrado no bundle: ${text}`);

const workflowFiles = (await readdir('.github/workflows')).filter((name) => /\.ya?ml$/i.test(name));
for (const name of workflowFiles) {
  const content = await read(`.github/workflows/${name}`);
  assert(!content.includes('CLOUDFLARE_API_TOKEN'), `${name} ainda depende de CLOUDFLARE_API_TOKEN.`);
  assert(!content.includes('CLOUDFLARE_ACCOUNT_ID'), `${name} ainda depende de CLOUDFLARE_ACCOUNT_ID.`);
  assert(!/wrangler\s+deploy(?!\s+--dry-run)/.test(content), `${name} ainda tenta fazer deploy direto pela Action.`);
}

console.log(`QA Supabase V70+ OK na V${versionNumber}: Worker V70 sobre base V62, arquitetura, versões, progresso e textos legados validados.`);

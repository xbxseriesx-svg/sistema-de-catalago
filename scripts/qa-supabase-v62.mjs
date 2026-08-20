import { readFile, readdir } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [bundle, index, runtimeLoaderV87, imagePage, progress, wrangler, workerV81, workerV71, workerV72, workerV70, workerV62, version, pkg] = await Promise.all([
  read('public/assets/index-V60Excel.js'),
  read('public/index.html'),
  read('public/runtime-loader-v87.js'),
  read('public/importar-imagens.html'),
  read('public/import-progress-v62.js'),
  read('wrangler.jsonc'),
  read('worker/index-v81.ts'),
  read('worker/index-v71.ts'),
  read('worker/index-v72.ts'),
  read('worker/index-v70.ts'),
  read('worker/index-v62.ts'),
  read('VERSION'),
  read('package.json').then(JSON.parse),
]);

const versionNumber = Number(version.trim());
const packagePatch = Number(String(pkg.version).split('.').at(-1));
assert(Number.isFinite(versionNumber) && versionNumber >= 70, 'VERSION precisa ser 70 ou superior nesta release.');
assert(packagePatch === versionNumber, 'package.json precisa acompanhar VERSION.');
assert(wrangler.includes('"main": "worker/index-v81.ts"'), 'Wrangler precisa apontar para a entrada auditada V81.');
assert(workerV81.includes("import worker from './index-v71'"), 'V81 precisa preservar o Worker V71 na cadeia.');
assert(workerV81.includes("database: 'Supabase Postgres'"), 'Health V81 precisa declarar Supabase Postgres.');
assert(workerV81.includes("storage: 'Supabase Storage'"), 'Health V81 precisa declarar Supabase Storage.');
assert(workerV81.includes('d1: false'), 'Health V81 precisa manter D1 desativado.');
assert(workerV71.includes("import worker from './index-v72'"), 'Worker V71 precisa encaminhar para o hotfix V72.');
assert(workerV72.includes("import baseWorker from './index-v70'"), 'Worker V72 precisa preservar o fluxo V70 como base.');
assert(workerV72.includes('duckduckgoImageSearch'), 'Worker V72 precisa manter a pesquisa ampla da web.');
assert(workerV72.includes('googleImageSearch'), 'Worker V72 precisa manter a consulta Google oficial.');
assert(workerV72.includes('customsearch.googleapis.com/customsearch/v1'), 'Worker V72 não aponta para a API oficial do Google Custom Search.');
assert(workerV72.includes('GOOGLE_IMAGES_NOT_CONFIGURED'), 'Worker V72 precisa informar quando as credenciais Google não estiverem configuradas.');
assert(workerV70.includes("import baseWorker from './index-v62'"), 'Worker V70 precisa preservar a base Supabase V62.');
assert(workerV62.includes("database: 'Supabase Postgres'"), 'Base V62 não declara Supabase Postgres.');
assert(workerV62.includes('d1: false'), 'Base V62 precisa declarar d1=false.');
assert(workerV62.includes("storage: 'Supabase Storage'"), 'Base V62 não declara Supabase Storage.');
assert(index.includes(`/runtime-loader-v87.js?v=${versionNumber}&perf=88`), 'Editor precisa ativar o loader contextual com cache da release atual.');
assert(runtimeLoaderV87.includes(`/import-progress-v62.js?v=${versionNumber}`), 'Loader V87 não preserva o progresso de importação na release atual.');
assert(runtimeLoaderV87.includes(`/import-progress-fetch-v62.js?v=${versionNumber}`), 'Loader V87 não preserva o acompanhamento de importação por fetch na release atual.');
assert(runtimeLoaderV87.includes('ADMIN_IMPORT'), 'Importação precisa permanecer disponível sob carregamento contextual no editor.');
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

console.log(`QA Supabase V70+V81 OK na V${versionNumber}: V81 -> V71 -> V72 -> V70/V62, Supabase, loader V87 e versões validados.`);

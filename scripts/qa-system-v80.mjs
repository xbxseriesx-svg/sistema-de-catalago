import fs from 'node:fs';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const read = (path) => fs.readFileSync(path, 'utf8');
const must = (content, pattern, label) => {
  const ok = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  if (!ok) throw new Error(`QA V81: ausente/inválido: ${label}`);
};
const mustNot = (content, pattern, label) => {
  const found = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  if (found) throw new Error(`QA V81: conteúdo indevido: ${label}`);
};

const index = read('public/index.html');
const runtimeLoaderV87 = read('public/runtime-loader-v87.js');
const editorRuntimeV87 = read('public/editor-runtime-v87.js');
const responsive = read('public/responsive-v67.js');
const runtime = read('public/system-runtime-v80.js');
const runtime81 = read('public/system-runtime-v81.js');
const marketingCanvas = read('public/marketing-canvas-hotfix.js');
const bundle = read('public/assets/index-V60Excel.js');
const worker = read('worker/index.ts');
const pkg = JSON.parse(read('package.json'));
const version = Number(read('VERSION').trim());
const release = `V${version}`;
const q = `?v=${version}`;

must(index, `ASTERYON Editor ${release}`, `título oficial ${release}`);
must(index, `/runtime-loader-v87.js${q}&perf=88`, 'loader contextual V88 carregado com cache da release atual');
must(runtimeLoaderV87, `/system-runtime-v80.js${q}&perf=88`, 'runtime legado V80 gerido sob demanda');
must(runtimeLoaderV87, `/system-runtime-v81.js${q}&perf=88`, 'runtime V81 gerido pelo loader V88');
mustNot(index, '/marketing-panel-scope-v79.js', 'V79 antigo não deve continuar ativo');
must(runtimeLoaderV87, `/marketing-canvas-hotfix.js${q}&perf=88`, 'objeto de Marketing preservado no carregamento contextual');

must(runtime, "['Produtos', 'Importar', 'Estrutura', 'Marcas', 'Ofertas', 'Marketing']", 'seis áreas de Gestão/Vínculos protegidas');
must(runtime, 'adicionar vitrine editavel', 'detecção da vitrine externa');
must(runtime, 'inserir no canvas', 'detecção da lista externa de produtos');
must(runtime, "mode === 'products'", 'modo Produtos preservado');
must(runtime, 'hideDuplicateImporter(context)', 'importador duplicado isolado');
must(runtime, 'isolateNestedPanel(context)', 'painel interno isolado em Ofertas/Marketing e demais abas');

must(bundle, 'Gestão do Catálogo', 'painel Gestão do Catálogo');
must(bundle, 'Promoções e Vitrine de Ofertas', 'editor de Ofertas');
must(bundle, 'Adicionar vitrine editável', 'vitrine editável');
must(bundle, 'Inserir no canvas', 'inserção de produto no canvas');
must(bundle, '/api/admin/catalog/offers', 'API de ofertas no frontend');
must(bundle, '/api/admin/marketing', 'API de marketing no frontend');
must(bundle, 'JSON.stringify({marketing:e})', 'contrato frontend de gravação do Marketing');
must(bundle, 'asteryon:marketing-live', 'evento de Marketing ao vivo');
must(bundle, 'asteryon:marketing-updated', 'evento de Marketing salvo');

must(marketingCanvas, 'asteryon:marketing-live', 'canvas acompanha edição ao vivo');
must(marketingCanvas, 'asteryon:marketing-updated', 'canvas acompanha conteúdo salvo');
must(marketingCanvas, '/api/admin/marketing', 'canvas persiste posição via Worker');
must(marketingCanvas, 'resize', 'objeto Marketing redimensionável');
must(marketingCanvas, 'pointermove', 'objeto Marketing movível');

must(index, `/assets/index-V60Excel.js${q}&perf=88`, 'cache do bundle acompanha a release atual');
must(runtimeLoaderV87, 'ASTER_V88_CONTEXT_LOADER', 'loader V88 materializado');
must(runtimeLoaderV87, 'ADMIN_MANAGEMENT', 'Gestão/Vínculos carregada somente quando necessária');
must(runtimeLoaderV87, 'requestIdleCallback', 'preparações tardias aguardam janela ociosa');
must(runtimeLoaderV87, 'ADMIN_BRANDS', 'recursos de Marcas usam carregamento contextual');
must(runtimeLoaderV87, 'ADMIN_IMPORT', 'recursos de Importação usam carregamento contextual');
mustNot(runtimeLoaderV87, 'const ADMIN_IDLE =', 'runtimes pesados não podem ser injetados em lote após abrir o editor');
must(editorRuntimeV87, 'AUTOSAVE_MS = 850', 'barreira de publicação respeita o debounce do autosave');
must(editorRuntimeV87, 'flushBeforePublish', 'publicação aguarda preparação do rascunho');
must(editorRuntimeV87, "replace(/brand/i, 'Marca')", 'rótulo técnico brand é corrigido somente na interface');
must(bundle, 'ASTER_V86_EDITOR_PERFORMANCE', 'hotfix V86 materializado no bundle');
mustNot(bundle, 's===null||JSON.stringify(t.nodes)===f.current', 'serialização eager do autosave removida do ciclo de render');
must(bundle, 'window.setTimeout(()=>{if(JSON.stringify(r.current.nodes)===f.current)return;g(r.current.nodes)', 'serialização do autosave adiada para o debounce');

must(responsive, 'ASTER_V88_RESPONSIVE_PERFORMANCE', 'camada responsiva V88 materializada');
must(responsive, 'ResizeObserver', 'geometria do editor desacoplada das mutações React');
must(responsive, 'record.addedNodes', 'observer responsivo filtrado por nós adicionados');
mustNot(responsive, 'new MutationObserver(schedule)', 'camada responsiva não pode voltar a rodar apply em toda mutação');
must(marketingCanvas, 'ASTER_V88_MARKETING_PERFORMANCE', 'Marketing V88 materializado');
must(marketingCanvas, 'loadConfigOnce', 'Marketing não repete leitura de configuração em toda mutação');
must(marketingCanvas, 'configLoaded && !active(config)', 'Marketing inativo ignora mutações do editor');
mustNot(marketingCanvas, 'new MutationObserver(() => mount())', 'Marketing não pode remontar/consultar em toda mutação');

must(runtime, 'pointerActive', 'runtime V80 suspende trabalho pesado durante interação por ponteiro');
must(runtime, 'new MutationObserver(() => schedule(120))', 'runtime V80 preserva debounce estrutural quando carregado');
mustNot(runtime, 'attributeFilter:', 'runtime V80 não observa class/aria globalmente');
mustNot(runtime, 'attributes: true', 'runtime V80 não observa atributos durante drag/resize');
must(runtime81, 'record.addedNodes', 'runtime V81 limita normalização às subárvores adicionadas');
must(runtime81, 'pendingRoots', 'runtime V81 agrupa subárvores antes de normalizar');
mustNot(runtime81, "document.addEventListener('click', schedule", 'runtime V81 não revarre todos os selects a cada clique');

must(worker, "path === '/api/admin/marketing'", 'rota admin Marketing');
must(worker, 'input.marketing || input', 'Worker aceita envelope marketing do frontend');
must(worker, "path === '/api/admin/catalog/offers'", 'rota admin Ofertas');
must(worker, "path === '/api/admin/catalog/settings'", 'rota configurações do catálogo');
must(worker, 'const snapshots = path.match', 'rotas de snapshots');
must(worker, 'const publish = path.match', 'rota de publicação');
must(worker, 'const rollback = path.match', 'rota de rollback');
must(worker, 'marketing_settings', 'persistência Marketing Supabase');
must(worker, 'offer_products', 'vínculos oferta-produto Supabase');
must(worker, 'page_snapshots', 'persistência de snapshots Supabase');
must(worker, 'page_publications', 'persistência de publicações Supabase');

for (const file of [
  'public/editor-runtime-v87.js',
  'public/runtime-loader-v87.js',
  'public/responsive-v67.js',
  'public/marketing-canvas-hotfix.js',
  'public/system-runtime-v80.js',
  'public/system-runtime-v81.js',
  'scripts/patch-editor-performance-v86.mjs',
  'scripts/prepare-bundle-v81.mjs',
]) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

if (!Number.isInteger(version) || version < 81) throw new Error(`QA V81: release lógica inválida ${version}`);
if (pkg.version !== `2.1.${version}`) throw new Error(`QA V81: package precisa acompanhar VERSION; recebido ${pkg.version}`);

console.log(`QA V80/V81 na release ${release} OK — V86/V87 preservadas, observers filtrados, Marketing sem polling por DOM e runtimes contextuais verificados.`);
process.exit(0);

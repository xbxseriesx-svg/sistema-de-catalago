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
const runtime = read('public/system-runtime-v80.js');
const runtime81 = read('public/system-runtime-v81.js');
const marketingCanvas = read('public/marketing-canvas-hotfix.js');
const bundle = read('public/assets/index-V60Excel.js');
const worker = read('worker/index.ts');
const pkg = JSON.parse(read('package.json'));
const version = Number(read('VERSION').trim());

must(index, 'ASTERYON Editor V81', 'título oficial V81');
must(index, '/system-runtime-v80.js?v=81', 'runtime legado V80 carregado com cache da release V81');
must(index, '/system-runtime-v81.js?v=81', 'runtime V81 carregado no index');
mustNot(index, '/marketing-panel-scope-v79.js', 'V79 antigo não deve continuar ativo');
must(index, '/marketing-canvas-hotfix.js?v=81', 'objeto de Marketing no canvas carregado');

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

// Regressões de performance V86: o editor não pode serializar a árvore completa
// em cada atualização de posição/tamanho nem varrer o DOM por mudanças de classe.
must(index, '/assets/index-V60Excel.js?v=81&perf=86', 'cache do bundle V86 renovado');
must(index, '/system-runtime-v80.js?v=81&perf=86', 'cache do runtime V80/V86 renovado');
must(index, '/system-runtime-v81.js?v=81&perf=86', 'cache do runtime V81/V86 renovado');
must(bundle, 'ASTER_V86_EDITOR_PERFORMANCE', 'hotfix V86 materializado no bundle');
mustNot(bundle, 's===null||JSON.stringify(t.nodes)===f.current', 'serialização eager do autosave removida do ciclo de render');
must(bundle, 'window.setTimeout(()=>{if(JSON.stringify(r.current.nodes)===f.current)return;g(r.current.nodes)', 'serialização do autosave adiada para o debounce');
must(runtime, 'pointerActive', 'runtime V80 suspende trabalho pesado durante interação por ponteiro');
must(runtime, 'new MutationObserver(() => schedule(120))', 'runtime V80 usa debounce estrutural');
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
  'public/system-runtime-v80.js',
  'public/system-runtime-v81.js',
  'scripts/patch-editor-performance-v86.mjs',
  'scripts/prepare-bundle-v81.mjs',
]) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

if (version !== 81) {
  throw new Error(`QA V81: VERSION esperada 81, recebida ${version}`);
}
if (pkg.version !== '2.1.81') {
  throw new Error(`QA V81: package version esperada 2.1.81, recebida ${pkg.version}`);
}

console.log('QA V81/V86 OK — release, editor responsivo, autosave adiado, observers otimizados, Vínculos, Ofertas, Marketing e persistência verificados.');
process.exit(0);

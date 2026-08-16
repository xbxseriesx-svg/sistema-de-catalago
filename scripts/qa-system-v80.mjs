import fs from 'node:fs';
import process from 'node:process';

const read = (path) => fs.readFileSync(path, 'utf8');
const must = (content, pattern, label) => {
  const ok = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  if (!ok) throw new Error(`QA V80: ausente/inválido: ${label}`);
};
const mustNot = (content, pattern, label) => {
  const found = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  if (found) throw new Error(`QA V80: conteúdo indevido: ${label}`);
};

const index = read('public/index.html');
const runtime = read('public/system-runtime-v80.js');
const marketingCanvas = read('public/marketing-canvas-hotfix.js');
const bundle = read('public/assets/index-V60Excel.js');
const worker = read('worker/index.ts');
const pkg = JSON.parse(read('package.json'));

must(index, '/system-runtime-v80.js?v=80', 'runtime V80 carregado no index');
mustNot(index, '/marketing-panel-scope-v79.js', 'V79 antigo não deve continuar ativo');
must(index, '/marketing-canvas-hotfix.js', 'objeto de Marketing no canvas carregado');

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

must(worker, "pathname === '/api/admin/marketing'", 'rota admin Marketing');
must(worker, "payload.marketing", 'Worker aceita envelope marketing do frontend');
must(worker, "pathname === '/api/admin/catalog/offers'", 'rota admin Ofertas');
must(worker, '/api/admin/catalog/settings', 'rota configurações do catálogo');
must(worker, '/snapshots', 'rotas de snapshots');
must(worker, '/publish', 'rota de publicação');
must(worker, '/rollback', 'rota de rollback');
must(worker, 'marketing_settings', 'persistência Marketing Supabase');
must(worker, 'offer_products', 'vínculos oferta-produto Supabase');

if (!String(pkg.version).startsWith('2.1.80')) {
  throw new Error(`QA V80: package version esperada 2.1.80, recebida ${pkg.version}`);
}

console.log('QA V80 OK — Vínculos, Ofertas, Marketing, canvas, snapshots, publicação e rollback verificados estaticamente.');
process.exit(0);

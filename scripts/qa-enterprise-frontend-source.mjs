import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const root = path.resolve('frontend');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const requiredSource = [
  'index.html',
  'vite.config.ts',
  'src/main.tsx',
  'src/editor/store.ts',
  'src/editor/registry.ts',
  'src/editor/geometry.ts',
  'src/editor/documentAdapter.ts',
  'src/editor/persistence.ts',
  'src/editor/usePersistence.ts',
  'src/editor/useShortcuts.ts',
  'src/editor/components/Canvas.tsx',
  'src/editor/components/NodeView.tsx',
  'src/editor/components/PropertiesPanel.tsx',
  'src/editor/components/LayersPanel.tsx',
  'src/editor/components/MarketingPreview.tsx',
  'src/editor/components/PublishedDocument.tsx',
  'src/editor/components/Toolbar.tsx',
  'src/lib/ai.functions.ts',
  'src/lib/spreadsheet.ts',
  'src/router.tsx',
  'src/routeTree.gen.ts',
  'src/routes/__root.tsx',
  'src/routes/admin.tsx',
  'src/routes/catalogo.tsx',
  'src/routes/index.tsx',
  'src/styles.css',
];
for (const file of requiredSource) assert.ok(exists(file), `Fonte Enterprise incompleta: ${file}`);

for (const removed of [
  'wrangler.jsonc',
  '.env.production',
  'src/lib/supabase.ts',
  'src/server.ts',
  'src/start.ts',
  'src/lib/ai-providers.server.ts',
  'src/lib/ai-search.server.ts',
  'src/lib/lovable-error-reporting.ts',
  'src/lib/error-capture.ts',
  'src/lib/error-page.ts',
]) {
  assert.equal(exists(removed), false, `Resíduo/deploy paralelo não permitido no frontend: ${removed}`);
}

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.version, '2.1.94', 'Frontend precisa acompanhar a versão oficial 2.1.94');
assert.equal(read('VERSION').trim(), '94', 'VERSION do frontend precisa acompanhar a release oficial');
assert.equal(Object.hasOwn(pkg.scripts || {}, 'deploy'), false, 'Frontend não pode ter script deploy próprio');
assert.equal(Object.hasOwn(pkg.scripts || {}, 'deploy:cloudflare'), false, 'Frontend não pode ter deploy Cloudflare próprio');
for (const dependency of ['@tanstack/react-start', '@tanstack/router-plugin', '@lovable.dev/vite-tanstack-config', 'nitro']) {
  assert.equal(Boolean(pkg.dependencies?.[dependency] || pkg.devDependencies?.[dependency]), false, `Runtime paralelo proibido: ${dependency}`);
}

const allSourceFiles = [];
const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else {
      allSourceFiles.push(absolute);
      if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) sourceFiles.push(absolute);
    }
  }
}
walk(path.join(root, 'src'));
assert.equal(allSourceFiles.length, 85, `Fonte React Enterprise precisa conter exatamente 85 arquivos em src; encontrados ${allSourceFiles.length}`);
assert.equal(sourceFiles.length, 83, `Fonte React/TS Enterprise precisa conter 83 arquivos de código; encontrados ${sourceFiles.length}`);

const source = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
for (const forbidden of [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  '/rest/v1/',
  '/storage/v1/',
  '/auth/v1/',
  'getSupabase(',
  'D1Database',
  'R2Bucket',
  'createServerFn',
  '@tanstack/react-start',
  '@lovable.dev/',
]) {
  assert.equal(source.includes(forbidden), false, `Frontend ainda contém acesso direto/runtime paralelo proibido: ${forbidden}`);
}

const persistence = read('src/editor/persistence.ts');
for (const route of [
  '/api/auth/status',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/admin/pages/',
  '/api/admin/media',
  '/api/public/pages/',
]) {
  assert.ok(persistence.includes(route), `Persistência precisa usar ${route}`);
}
assert.ok(persistence.includes('serializeForLegacyStorage'), 'Save precisa preservar formato de rollback V94 durante a transição');
assert.ok(persistence.includes('expectedRevision: remoteRevision'), 'Save precisa manter proteção contra conflito de revisão');
assert.ok(persistence.includes('schemaVersion: 5'), 'Versão interna do documento precisa ser identificada como schemaVersion');
assert.equal(source.includes('ASTERYON V5'), false, 'Frontend não pode anunciar V5 como versão da aplicação');

const aiClient = read('src/lib/ai.functions.ts');
for (const route of ['/api/admin/ai/test', '/api/admin/ai/chat', '/api/admin/ai/search']) {
  assert.ok(aiClient.includes(route), `ASTERYON AI precisa usar gateway same-origin ${route}`);
}
const editorRoute = read('src/routes/index.tsx');
assert.ok(editorRoute.includes('overflow-y-auto'), 'Painéis laterais precisam possuir rolagem vertical explícita');
assert.equal(editorRoute.includes('flex-1 overflow-hidden'), false, 'Painel de elementos não pode bloquear rolagem com overflow-hidden');

const adminRoute = read('src/routes/admin.tsx');
for (const token of [
  'parseSpreadsheetFile',
  '/api/admin/catalog/products/bulk',
  'Arquivo para importar',
  '.xlsx,.csv',
  'Importar produtos',
  'data-asteryon-import-summary',
]) assert.ok(adminRoute.includes(token), `Importador Enterprise incompleto: ${token}`);

const spreadsheetSource = read('src/lib/spreadsheet.ts');
for (const token of ['DecompressionStream', 'xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml', 'mapProductRow', 'sourceColumns']) {
  assert.ok(spreadsheetSource.includes(token), `Parser XLSX/CSV Enterprise incompleto: ${token}`);
}
const spreadsheetJs = ts.transpileModule(spreadsheetSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const spreadsheet = await import(`data:text/javascript;base64,${Buffer.from(spreadsheetJs).toString('base64')}`);
const realRow = {
  'Código': '32',
  'Descrição': 'BALA FLOPI DIET 40G FLORESTAL',
  'Descrição do departamento': 'ATACADO',
  'Descrição da seção': 'BOMBONIERI',
  'Marca': 'FLORESTAL',
  'Nome da categoria': 'BALAS & DROPS',
  'Embalagem': '12X40G',
  'Descrição da unidade': 'DISPLAY',
  'Embalagem Master': '04X12X40G',
  'Descrição da unidade_1': 'CAIXA',
  'NCM + Exceção': '21069090.',
  'NCM': '21069090',
  'Unidade Venda [EAN8, UPC12, EAN13, e DUN14]': '7896321005601',
  'Unidade Master [EAN8, UPC12, EAN13, e DUN14]': '17896321005608',
};
const product = spreadsheet.mapProductRow(realRow);
assert.ok(product, 'a linha real da planilha precisa ser aceita pela fonte Enterprise');
assert.equal(product.code, '32');
assert.equal(product.name, 'BALA FLOPI DIET 40G FLORESTAL');
assert.equal(product.departamentoName, 'ATACADO');
assert.equal(product.secaoName, 'BOMBONIERI');
assert.equal(product.categoriaName, 'BALAS & DROPS');
assert.equal(product.brandName, 'FLORESTAL');
assert.equal(product.packaging, '12X40G');
assert.equal(product.unit, 'DISPLAY');
assert.equal(product.ncm, '21069090');
assert.equal(product.ean, '7896321005601');
assert.equal(product.technical['Embalagem Master'], '04X12X40G');
assert.equal(product.technical['Descrição da unidade Master'], 'CAIXA');
assert.equal(product.technical['NCM + Exceção'], '21069090.');
assert.equal(product.technical['Unidade Master EAN'], '17896321005608');
assert.equal(Object.keys(product.sourceColumns).length, 14, 'as 14 colunas originais precisam ser preservadas');
assert.equal(spreadsheet.mapProductRow({ ...realRow, 'Nome da categoria': '' }), null, 'categoria continua obrigatória');

const adapterSource = read('src/editor/documentAdapter.ts');
const adapterJs = ts.transpileModule(adapterSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const adapter = await import(`data:text/javascript;base64,${Buffer.from(adapterJs).toString('base64')}`);
const makeFrame = (i, width) => ({ x: i % 31, y: i * 2, width, height: 50 + (i % 17) });
const children = [];
for (let i = 1; i < 460; i++) {
  children.push({
    id: `node_${i}`,
    type: i % 5 === 0 ? 'image' : 'text',
    name: `Node ${i}`,
    x: i,
    y: i * 2,
    width: 120 + (i % 7),
    height: 40 + (i % 11),
    rotation: 0,
    zIndex: i,
    visible: true,
    locked: false,
    opacity: 1,
    responsive: { tablet: makeFrame(i, 100), mobile: makeFrame(i, 80) },
    styles: {},
    props: { text: `conteudo-${i}` },
    children: [],
  });
}
const legacy = [{
  id: 'root',
  type: 'page',
  name: 'Home',
  x: 0,
  y: 0,
  width: 1920,
  height: 3000,
  rotation: 0,
  zIndex: 0,
  visible: true,
  locked: false,
  opacity: 1,
  responsive: {
    tablet: { x: 0, y: 0, width: 834, height: 3200 },
    mobile: { x: 0, y: 0, width: 390, height: 4100 },
  },
  styles: {},
  props: {},
  children,
}];

const normalized = adapter.normalizePersistedDocument(legacy);
assert.ok(normalized, 'Árvore recursiva precisa normalizar');
assert.equal(adapter.countDocumentNodes(normalized), 460, 'Round-trip deve suportar os 460 nós observados na V94');
assert.equal(normalized.nodes.root.responsive.desktop.width, 1920, 'Desktop precisa ser sintetizado dos campos base V94');
assert.equal(normalized.nodes.node_10.parentId, 'root', 'parentId precisa ser reconstruído');
assert.equal(adapter.hasCompleteResponsiveFrames(normalized), true, 'Todos os modos precisam ficar completos');

const serialized = adapter.serializeForLegacyStorage(normalized);
assert.equal(Array.isArray(serialized), true);
assert.equal(serialized.length, 1);
assert.equal(serialized[0].children.length, 459);
assert.equal(Object.hasOwn(serialized[0].responsive, 'desktop'), false, 'Storage precisa continuar compatível com V94: desktop nos campos base');
const normalizedAgain = adapter.normalizePersistedDocument(serialized);
assert.equal(adapter.countDocumentNodes(normalizedAgain), 460);
assert.deepEqual(normalizedAgain, normalized, 'Normalizar → serializar → normalizar não pode perder conteúdo/geometria');

console.log('QA Frontend Enterprise: OK — SPA único, 85 arquivos-fonte, importador XLSX/CSV de 14 colunas, API same-origin e round-trip V94↔schema 5 com 460 nós.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const bundle = await readFile('public/assets/index-V60Excel.js', 'utf8');
const search = await readFile('public/public-global-search-v78.js', 'utf8');
const runtime = await readFile('public/system-runtime-v81.js', 'utf8');
const index = await readFile('public/index.html', 'utf8');

assert.match(bundle, /ASTER_V81_CORE_PATCH/, 'Patch V81 não materializado.');
assert.match(bundle, /e\.type==="breadcrumb"&&l\.jsx\(wq,\{node:e,updateProp:d\}\),l\.jsx\(cq,\{node:e\}\),l\.jsx\(Cq/, 'Biblioteca de ação/alinhamento precisa estar no inspetor comum.');
assert.equal((bundle.match(/l\.jsx\(cq,\{node:e\}\)/g) || []).length, 1, 'Ações não podem continuar duplicadas/exclusivas no inspetor de Botão.');
assert.doesNotMatch(bundle, /e\.type==="button"\|\|e\.type==="productbutton"/, 'Renderer ainda restringe clique a botões.');
assert.match(bundle, /querySelectorAll\('\[data-node-id\]'\)|closest\('\[data-node-id\]'\)|'\[data-node-id\]'/, 'Preview precisa delegar clique por node id, não por tipo de botão.');

assert.match(bundle, /function V81Rules\(/);
assert.match(bundle, /label:"Regras"/);
assert.match(bundle, /i==="rules"\?l\.jsx\(V81Rules/);
assert.match(bundle, /As regras usam a mesma biblioteca de ações dos Elementos e Ajustes/);
assert.match(index, /system-runtime-v81\.js\?v=81/);
assert.match(runtime, /option\.value === 'none'/);
assert.match(runtime, /Nenhum \(padrão\)/);
assert.match(runtime, /funcao ao clicar/);

for (const action of ['product-info', 'brand-page', 'department-page', 'section-page', 'category-page', 'promotion-page', 'banner-open', 'whatsapp', 'custom-action']) {
  assert.ok(bundle.includes(action), `Biblioteca comum perdeu a ação ${action}.`);
}

assert.match(bundle, /function V81CarouselEditor\(/);
assert.match(bundle, /function V81CarouselRenderer\(/);
assert.match(bundle, /value:"brands",children:"Apenas Marcas"/);
assert.match(bundle, /value:"products",children:"Produtos"/);
assert.match(bundle, /value:"multiple",children:"Múltipla"/);
assert.match(bundle, /value:"single",children:"Única"/);
assert.match(bundle, /Buscar marca\.\.\./);
assert.match(bundle, /Buscar código, produto ou marca\.\.\./);
assert.match(bundle, /Todos os departamentos/);
assert.match(bundle, /type:"checkbox"/);
assert.match(bundle, /Remover/);
assert.match(bundle, /Confirmar seleção/);
assert.match(bundle, /selectedBrandIds/);
assert.match(bundle, /selectedProductIds/);
assert.match(bundle, /href:"\/produto\/"\+encodeURIComponent\(y\)/, 'Produto selecionado no carrossel precisa abrir sua página/detalhes.');
assert.match(bundle, /href:"\/marca\/"\+encodeURIComponent\(s\.slug\|\|s\.id\|\|""\)/, 'Logo da marca precisa ser navegável sem texto adicional no slide.');

assert.match(search, /Consulta geral do catálogo/);
assert.match(search, /product\.code|product\.codigo/);
assert.match(search, /brand\?\.name/);
assert.match(search, /department\?\.name/);
assert.match(search, /section\?\.name/);
assert.match(search, /category\?\.name/);
assert.match(search, /exactCode \? 500/);
assert.match(search, /SEARCH_BUTTON_LABELS/);
assert.match(search, /consulta/);

execFileSync(process.execPath, ['--check', 'public/assets/index-V60Excel.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/public-global-search-v78.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/system-runtime-v81.js'], { stdio: 'pipe' });
console.log('QA UI V81: OK — ações/alinhamento universais, Regras, Carrossel Marcas/Produtos e Consulta geral validados.');

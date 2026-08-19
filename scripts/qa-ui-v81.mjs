import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const bundle = await readFile('public/assets/index-V60Excel.js', 'utf8');
const search = await readFile('public/public-global-search-v78.js', 'utf8');
const runtime = await readFile('public/system-runtime-v81.js', 'utf8');
const entityPopups = await readFile('public/public-entity-popups-v81.js', 'utf8');
const brandPopupFix = await readFile('public/public-brand-popup-fix-v83.js', 'utf8');
const popupGuard = await readFile('public/public-entity-popup-guard-v81.js', 'utf8');
const index = await readFile('public/index.html', 'utf8');

assert.match(bundle, /ASTER_V81_CORE_PATCH/, 'Patch V81 não materializado.');
assert.match(bundle, /ASTER_V81_WHITE_SCREEN_FIX/, 'Hotfix V81 contra tela branca não materializado.');
assert.match(bundle, /e\.type==="breadcrumb"&&l\.jsx\(wq,\{node:e,updateProp:d\}\),l\.jsx\(cq,\{node:e\}\),l\.jsx\(Cq/, 'Biblioteca de ação/alinhamento precisa estar no inspetor comum.');
assert.equal((bundle.match(/l\.jsx\(cq,\{node:e\}\)/g) || []).length, 1, 'Ações não podem continuar duplicadas/exclusivas no inspetor de Botão.');
assert.doesNotMatch(bundle, /\(Q\)&&l\.jsx\(yq,\{node:e,updateStyle:s,updateProp:d,mode:t\}\)/, 'Condição Q inválida derruba o editor ao selecionar um objeto.');
assert.match(bundle, /\(e\.type==="button"\|\|e\.type==="productbutton"\)&&l\.jsx\(yq,\{node:e,updateStyle:s,updateProp:d,mode:t\}\)/, 'Painel específico de botão precisa manter sua condição de tipo válida.');
assert.match(bundle, /y=h\.type!=="none"/, 'Renderer público precisa permitir ação resolvida em qualquer tipo de objeto.');
assert.doesNotMatch(bundle, /y=\(d\.type==="button"\|\|d\.type==="productbutton"\)&&h\.type!=="none"/, 'Renderer público ainda restringe ação a botões.');
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
assert.match(bundle, /href:"\/produto\/"\+encodeURIComponent\(y\)/, 'Produto selecionado no carrossel precisa ter destino público interceptável pelo popup.');
assert.match(bundle, /href:"\/marca\/"\+encodeURIComponent\(s\.slug\|\|s\.id\|\|""\)/, 'Logo da marca precisa ter destino público interceptável pelo popup.');

assert.match(search, /Consulta geral do catálogo/);
assert.match(search, /product\.code|product\.codigo/);
assert.match(search, /brand\?\.name/);
assert.match(search, /department\?\.name/);
assert.match(search, /section\?\.name/);
assert.match(search, /category\?\.name/);
assert.match(search, /exactCode \? 500/);
assert.match(search, /SEARCH_BUTTON_LABELS/);
assert.match(search, /consulta/);
assert.match(search, /asteryon-global-search-v78\[data-open="true"\]/, 'Busca geral precisa expor estado data-open para coexistir com os popups.');

assert.match(index, /public-entity-popups-v81\.js\?v=81/, 'Runtime de popup público precisa estar carregado.');
assert.match(index, /public-brand-popup-fix-v83\.js\?v=85/, 'Runtime V85 dos cards de marca precisa estar carregado com cache renovado.');
assert.match(index, /public-entity-popup-guard-v81\.js\?v=81/, 'Guard de scroll dos popups precisa estar carregado.');
assert.match(entityPopups, /function openBrand\(key\)/, 'Popup de marca ausente.');
assert.match(entityPopups, /function openProduct\(key\)/, 'Popup de produto ausente.');
assert.match(entityPopups, /parts\[0\] === 'marca'/, 'Links de marca precisam ser interceptados.');
assert.match(entityPopups, /parts\[0\] === 'produto'/, 'Links de produto precisam ser interceptados.');
assert.match(entityPopups, /event\.preventDefault\(\)/, 'Popup precisa impedir navegação da página.');
assert.match(entityPopups, /data-aep81-product/, 'Popup de marca precisa listar produtos clicáveis.');
assert.match(entityPopups, /data-aep81-brand/, 'Popup de produto precisa permitir abrir a marca.');
assert.match(entityPopups, /Produtos similares da marca/, 'Popup de produto precisa manter produtos relacionados.');
assert.match(entityPopups, /role', 'dialog'/, 'Popup precisa ser identificado como diálogo acessível.');
assert.match(entityPopups, /@media\(max-width:720px\)/, 'Popup precisa ser responsivo no mobile.');

assert.match(brandPopupFix, /const VERSION = '85'/, 'Correção determinística de marcas precisa estar na V85.');
assert.match(brandPopupFix, /fetchJson\('\/api\/public\/pages\/home'\)/, 'V85 precisa ler os nós publicados da home.');
assert.match(brandPopupFix, /fetchJson\('\/api\/public\/brands'\)/, 'V85 precisa carregar o cadastro real de marcas.');
assert.match(brandPopupFix, /function brandKeyFromPageNode/, 'V85 precisa obter a marca diretamente do nó publicado.');
assert.match(brandPopupFix, /props\.actionEntityId/, 'V85 precisa usar o ID de marca gravado no editor, sem adivinhar pelo texto Brand.');
assert.match(brandPopupFix, /brand\?\.logoUrl \|\| brand\?\.logo_url \|\| brand\?\.logo/, 'V85 precisa aceitar os formatos de URL de logo do catálogo.');
assert.match(brandPopupFix, /data-brand-id/, 'Card publicado precisa receber ID real da marca.');
assert.match(brandPopupFix, /data-asteryon-brand-runtime-v85/, 'Card publicado precisa receber a camada visual V85.');
assert.match(brandPopupFix, /function fallbackName/, 'Marca sem logo precisa mostrar o nome real como fallback.');
assert.match(brandPopupFix, /api\.openBrand\(brandId\)/, 'Clique no card de marca precisa abrir o popup sem navegar para outra página.');
assert.match(brandPopupFix, /stopImmediatePropagation/, 'V85 precisa bloquear a navegação concorrente para \/marca\/.');
assert.match(brandPopupFix, /MutationObserver/, 'V85 precisa reaplicar o vínculo após renderizações dinâmicas.');
assert.match(brandPopupFix, /__ASTERYON_BRAND_POPUP_FIX_TEST__/, 'V85 precisa manter helpers testáveis em Node.');

assert.match(popupGuard, /asteryon-entity-popup-v81/, 'Guard precisa observar popup de entidade.');
assert.match(popupGuard, /asteryon-global-search-v78/, 'Guard precisa observar popup de busca.');
assert.match(popupGuard, /MutationObserver/, 'Guard precisa reagir à troca de estado dos popups.');
assert.match(popupGuard, /entity\?\.dataset\.open === 'true'/, 'Guard precisa reconhecer entidade aberta.');
assert.match(popupGuard, /search\?\.dataset\.open === 'true'/, 'Guard precisa reconhecer busca aberta.');

execFileSync(process.execPath, ['--check', 'public/assets/index-V60Excel.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/public-global-search-v78.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/public-entity-popups-v81.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/public-brand-popup-fix-v83.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/public-entity-popup-guard-v81.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/system-runtime-v81.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'scripts/qa-brand-node-popup-v85.mjs'], { stdio: 'pipe' });
execFileSync(process.execPath, ['scripts/qa-brand-node-popup-v85.mjs'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'scripts/patch-white-screen-v81.mjs'], { stdio: 'pipe' });
console.log('QA UI V81/V85: OK — ações, carrossel, consulta, logos de marcas e popups validados.');

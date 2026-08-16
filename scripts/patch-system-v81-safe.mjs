import fs from 'node:fs';

const path = 'public/assets/index-V60Excel.js';
let source = fs.readFileSync(path, 'utf8');
const MARKER = 'ASTER_V81_CORE_PATCH';
const rulesComponent = fs.readFileSync('scripts/v81-rules-inject.txt', 'utf8').trim();
const carouselHelpers = fs.readFileSync('scripts/v81-carousel-inject.txt', 'utf8').trim();

if (source.includes(MARKER)) {
  console.log('Patch V81 já materializado no bundle.');
  process.exit(0);
}

function replaceOnce(find, replacement, label) {
  const first = source.indexOf(find);
  if (first < 0) throw new Error(`Patch V81: trecho não encontrado: ${label}`);
  if (source.indexOf(find, first + find.length) >= 0) throw new Error(`Patch V81: trecho duplicado inesperadamente: ${label}`);
  source = source.slice(0, first) + replacement + source.slice(first + find.length);
}

function replaceCount(find, replacement, expected, label) {
  const count = source.split(find).length - 1;
  if (count !== expected) throw new Error(`Patch V81: ${label}: esperados ${expected}, encontrados ${count}`);
  source = source.split(find).join(replacement);
}

// Biblioteca única de Alinhamento + Função ao clicar para todo objeto.
replaceOnce('l.jsx(cq,{node:e}),', '', 'remover ações exclusivas do Botão');
replaceOnce(
  'e.type==="breadcrumb"&&l.jsx(wq,{node:e,updateProp:d}),l.jsx(Cq,{node:e,updateStyle:s,update:o,mode:t})',
  'e.type==="breadcrumb"&&l.jsx(wq,{node:e,updateProp:d}),l.jsx(cq,{node:e}),l.jsx(Cq,{node:e,updateStyle:s,update:o,mode:t})',
  'inserir ações no inspetor comum',
);

// Clique público para qualquer objeto cuja ação resolvida não seja "none".
// IMPORTANTE: o alvo é a condição do renderer NR. Uma substituição genérica aqui
// atingia o inspetor hq e gerava ReferenceError (Q), derrubando o editor ao selecionar.
replaceOnce(
  'y=(d.type==="button"||d.type==="productbutton")&&h.type!=="none"',
  'y=h.type!=="none"',
  'restrição de clique apenas a botões no renderer público',
);
replaceOnce(
  `'[data-node-type="button"],[data-node-type="button"] *,[data-node-type="productbutton"],[data-node-type="productbutton"] *{pointer-events:auto!important;cursor:pointer!important;}'`,
  `'[data-node-id]{pointer-events:auto!important}'`,
  'pointer events do preview',
);
replaceOnce(`'[data-node-type="button"],[data-node-type="productbutton"]'`, `'[data-node-id]'`, 'delegação do preview');

// Tela Regras: mesma biblioteca cq, portanto sem divergência de funcionalidades.
replaceOnce('function XY(){', rulesComponent + 'function XY(){', 'componente Regras');
replaceOnce('i==="offers"?l.jsx(A_,{}):l.jsx(XY,{})', 'i==="offers"?l.jsx(A_,{}):i==="rules"?l.jsx(V81Rules,{}):l.jsx(XY,{})', 'roteamento Regras');
replaceOnce(
  'l.jsx(ci,{active:i==="offers",onClick:()=>o("offers"),icon:l.jsx($r,{size:13}),label:"Ofertas"}),l.jsx(ci,{active:i==="history",onClick:()=>o("history"),icon:l.jsx($c,{size:13}),label:"Histórico"})',
  'l.jsx(ci,{active:i==="offers",onClick:()=>o("offers"),icon:l.jsx($r,{size:13}),label:"Ofertas"}),l.jsx(ci,{active:i==="rules",onClick:()=>o("rules"),icon:l.jsx(Jc,{size:13}),label:"Regras"}),l.jsx(ci,{active:i==="history",onClick:()=>o("history"),icon:l.jsx($c,{size:13}),label:"Histórico"})',
  'aba Regras expandida',
);
replaceOnce(
  'l.jsx(Or,{onClick:()=>{d(!0),o("offers")},title:"Ofertas",children:l.jsx($r,{size:16})}),l.jsx(Or,{onClick:()=>{d(!0),o("history")},title:"Histórico",children:l.jsx($c,{size:16})})',
  'l.jsx(Or,{onClick:()=>{d(!0),o("offers")},title:"Ofertas",children:l.jsx($r,{size:16})}),l.jsx(Or,{onClick:()=>{d(!0),o("rules")},title:"Regras",children:l.jsx(Jc,{size:16})}),l.jsx(Or,{onClick:()=>{d(!0),o("history")},title:"Histórico",children:l.jsx($c,{size:16})})',
  'aba Regras recolhida',
);

// Marketing > Carrossel: imagens legadas + Marcas + Produtos.
replaceOnce(
  'carousel:{active:!1,speed:1,loop:!0,autoplay:!0,manual:!0,items:[]}',
  'carousel:{active:!1,speed:1,loop:!0,autoplay:!0,manual:!0,mode:"images",selectionMode:"multiple",selectedBrandIds:[],selectedProductIds:[],items:[]}',
  'defaults do carrossel',
);
replaceOnce('function _I({config:e})', carouselHelpers + 'function _I({config:e})', 'helpers do carrossel');
replaceOnce('r.active&&r.items.length>0&&l.jsx(DY,{config:r,theme:n})', 'r.active&&V81CarouselCount(r)>0&&l.jsx(V81CarouselRenderer,{config:r,theme:n})', 'renderizador do carrossel');
replaceOnce('n==="carousel"&&l.jsx(HY,{config:e,patch:y,upload:v,busy:o,move:g,remove:m})', 'n==="carousel"&&l.jsx(V81CarouselEditor,{config:e,patch:y,upload:v,busy:o,move:g,remove:m})', 'editor do carrossel');
replaceCount('e.carousel.active&&e.carousel.items.length>0', 'e.carousel.active&&V81CarouselCount(e.carousel)>0', 1, 'visibilidade Marketing preview');
replaceCount('k.carousel.active&&k.carousel.items.length>0', 'k.carousel.active&&V81CarouselCount(k.carousel)>0', 1, 'visibilidade Marketing editor');

replaceOnce('function DJ(){', `const ${MARKER}=true;function DJ(){`, 'marcador V81');
fs.writeFileSync(path, source);
console.log('Patch V81 aplicado com segurança: ações universais, Regras e carrossel Marcas/Produtos.');

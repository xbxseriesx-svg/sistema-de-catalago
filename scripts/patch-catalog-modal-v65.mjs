import { readFile, writeFile } from 'node:fs/promises';

const assetPath = 'public/assets/index-V60Excel.js';
const original = await readFile(assetPath, 'utf8');
let source = original;

function replaceRequired(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`V65: marcador não encontrado: ${label}`);
  source = source.replace(from, to);
}

// 1) Ações de catálogo/menu. Botões antigos com scroll #catalogo continuam válidos,
// mas passam a abrir modal. Novos botões podem selecionar ações explícitas.
replaceRequired(
  'if(a==="none")return!1;if(a==="scroll")return Cr(r);',
  'if(a==="none")return!1;if(a==="catalog-modal"||a==="scroll"&&r==="#catalogo")return window.dispatchEvent(new CustomEvent("asteryon:catalog-open")),!0;if(a==="catalog-menu")return window.dispatchEvent(new CustomEvent("asteryon:catalog-menu")),!0;if(a==="scroll")return Cr(r);',
  'executor de ações',
);
replaceRequired(
  'fa(n,"catalogo","catálogo","produtos","mix completo")?Da(e,"scroll","#catalogo",!0)',
  'fa(n,"catalogo","catálogo","produtos","mix completo")?Da(e,"catalog-modal","",!0)',
  'inferência de catálogo',
);
replaceRequired(
  'automatic:[["none","Automática pelo texto"],["scroll","Ir para uma seção"],["url","Abrir link / página"],["top","Voltar ao topo"]]',
  'automatic:[["none","Automática pelo texto"],["catalog-modal","Abrir catálogo em pop-up"],["catalog-menu","Abrir menu do catálogo"],["scroll","Ir para uma seção"],["url","Abrir link / página"],["top","Voltar ao topo"]]',
  'opções de ação automática',
);

// product-info/details passam a abrir o modal global em vez de navegar para /produto.
replaceRequired(
  'if(QT.has(a)){if(!o)return Dr("Selecione um produto para esta ação."),!1;const f=',
  'if(QT.has(a)){if(!o)return Dr("Selecione um produto para esta ação."),!1;if(a==="product-info"||a==="product-details")return window.dispatchEvent(new CustomEvent("asteryon:product-open",{detail:{productId:o}})),!0;const f=',
  'produto em modal',
);

// 2) O componente de Menu vira somente o drawer/controlador por evento. O botão
// visível passa a ser um elemento normal do editor (adicionado no modelo/dados).
const menuStart = source.indexOf('function mJ({products:e,hierarchy:t,theme:a,editorMode:eM=!1})');
const menuEnd = source.indexOf('function gJ(', menuStart);
if (menuStart < 0 || menuEnd < 0) throw new Error('V65: componente mJ pós-V64 não encontrado.');
let menu = source.slice(menuStart, menuEnd);
if (!menu.includes('asteryon:catalog-menu')) {
  menu = menu.replace(
    'function mJ({products:e,hierarchy:t,theme:a,editorMode:eM=!1}){const[r,n]=q.useState(!1),',
    'function mJ({products:e,hierarchy:t,theme:a,editorMode:eM=!1}){const[r,n]=q.useState(!1);q.useEffect(()=>{const o=()=>n(!0);return window.addEventListener("asteryon:catalog-menu",o),()=>window.removeEventListener("asteryon:catalog-menu",o)},[]);const ',
  );
  // A substituição acima termina com "const ", e o código original continuava com i=...
  // portanto restaura a declaração local exatamente como antes.
  menu = menu.replace('const i=t.filter', 'const i=t.filter');
}
const triggerRe = /l\.jsxs\("button",\{"aria-label":"Abrir menu","aria-expanded":r,onClick:\(\)=>n\(!0\),className:`\$\{eM\?"absolute":"fixed"\} left-3 top-3 z-\[999990\] flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-white shadow-xl`,style:\{background:a\.primary\},children:\[l\.jsx\(Il,\{size:17\}\),"Menu"\]\}\),/;
if (triggerRe.test(menu)) menu = menu.replace(triggerRe, '');
if (menu.includes('aria-label:"Abrir menu"')) throw new Error('V65: trigger hardcoded do Menu ainda existe.');
menu = menu.replace(
  'href:eM?"#":"/#catalogo",onClick:o=>{eM?o.preventDefault():n(!1)}',
  'href:"#",onClick:o=>{o.preventDefault(),n(!1),window.dispatchEvent(new CustomEvent("asteryon:catalog-open"))}',
);
menu = menu.replace(
  'href:eM?"#":`/?categoria=${encodeURIComponent(d.id)}#catalogo`,onClick:o=>{eM?o.preventDefault():n(!1)}',
  'href:"#",onClick:o=>{o.preventDefault(),n(!1),window.dispatchEvent(new CustomEvent("asteryon:catalog-open"))}',
);
menu = menu.replace(
  'href:eM?"#":`/produto/${encodeURIComponent(String(u.id))}`,onClick:o=>{if(eM)o.preventDefault()},className:',
  'href:"#",onClick:o=>{o.preventDefault(),n(!1),window.dispatchEvent(new CustomEvent("asteryon:product-open",{detail:{productId:String(u.id)}}))},className:',
);
source = source.slice(0, menuStart).concat(menu, source.slice(menuEnd));

// 3) Catálogo vira modal. Reutiliza exatamente os filtros/cards existentes.
let gStart = source.indexOf('function gJ(');
let gEnd = source.indexOf('function vJ(', gStart);
if (gStart < 0 || gEnd < 0) throw new Error('V65: componente gJ não encontrado.');
let catalog = source.slice(gStart, gEnd);
if (!catalog.includes('open:eO=!1')) {
  catalog = catalog.replace(
    'function gJ({products:e,brands:t,hierarchy:a,settings:r,onProduct:n,theme:i})',
    'function gJ({products:e,brands:t,hierarchy:a,settings:r,onProduct:n,theme:i,open:eO=!1,onClose:eC})',
  );
  const oldReturn = 'return!e.length||!v.length?null:l.jsx("section",{';
  const newReturn = 'return!eO||!e.length||!v.length?null:l.jsx("div",{className:"fixed inset-0 z-[999998] overflow-y-auto bg-black/60 p-3 sm:p-6",onClick:eC,children:l.jsxs("div",{className:"mx-auto max-h-[94vh] w-full max-w-7xl overflow-y-auto rounded-2xl shadow-2xl",style:{background:i.background,color:i.text},onClick:b=>b.stopPropagation(),children:[l.jsxs("div",{className:"sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3",style:{background:i.surface,borderColor:`${i.primary}22`},children:[l.jsxs("div",{children:[l.jsx("div",{className:"text-xs font-black uppercase",style:{color:i.primary},children:"Catálogo"}),l.jsx("div",{className:"text-sm font-bold",children:"Filtre e selecione um produto"})]}),l.jsx("button",{onClick:eC,"aria-label":"Fechar catálogo",className:"rounded-lg border p-2",style:{borderColor:`${i.primary}44`},children:l.jsx(Ea,{size:18})})]}),l.jsx("section",{';
  if (!catalog.includes(oldReturn)) throw new Error('V65: retorno do catálogo não localizado.');
  catalog = catalog.replace(oldReturn, newReturn);
  if (!catalog.endsWith('}')) throw new Error('V65: fim do componente catálogo inválido.');
  catalog = catalog.slice(0, -1) + ']})})}';
}
source = source.slice(0, gStart).concat(catalog, source.slice(gEnd));

// 4) Produto em modal com ações e produtos similares abaixo.
const mjStart = source.indexOf('function MJ(');
const mjEnd = source.indexOf('function wJ(', mjStart);
if (mjStart < 0 || mjEnd < 0) throw new Error('V65: componente MJ não encontrado.');
const productModal = `function MJ({product:e,products:p=[],brands:t,hierarchy:a,settings:r,onClose:n,onProduct:oP,theme:i}){const s=p.filter(h=>String(h.id)!==String(e.id)&&String(h.categoriaId)===String(e.categoriaId)).slice(0,10);return l.jsx("div",{className:"fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 p-4",onClick:n,children:l.jsxs("div",{className:"max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl p-6 shadow-2xl",style:{background:i.surface,color:i.text},onClick:o=>o.stopPropagation(),children:[l.jsxs("div",{className:"flex items-start justify-between gap-4",children:[l.jsxs("div",{children:[l.jsxs("div",{className:"text-xs font-bold uppercase",style:{color:i.primary},children:["Produto · ",e.code]}),l.jsx("h2",{className:"mt-1 text-2xl font-extrabold",children:e.shortDescription||e.name})]}),l.jsx("button",{onClick:n,"aria-label":"Fechar produto",className:"rounded-lg border px-3 py-2 text-sm font-bold",style:{borderColor:\`${'${i.primary}'}44\`},children:l.jsx(Ea,{size:16})})]}),l.jsx("div",{className:"mt-5",children:l.jsx(FR,{product:e,brands:t,hierarchy:a,settings:r,theme:i})}),l.jsxs("div",{className:"mt-5 flex flex-wrap gap-2",children:[l.jsx(kd,{onClick:()=>md("asteryon.favorites",String(e.id),"Produto adicionado aos favoritos."),icon:l.jsx(vl,{size:15}),label:"Favoritar",theme:i}),l.jsx(kd,{onClick:()=>md("asteryon.compare",String(e.id),"Produto adicionado à comparação.",4),icon:l.jsx(Rl,{size:15}),label:"Comparar",theme:i}),l.jsx(kd,{onClick:()=>md("asteryon.quote",String(e.id),"Produto adicionado à cotação."),icon:l.jsx(Al,{size:15}),label:"Cotação",theme:i}),l.jsx(kd,{onClick:()=>md("asteryon.order",String(e.id),"Produto adicionado ao pedido."),icon:l.jsx(Bl,{size:15}),label:"Pedido",theme:i})]}),l.jsx(tT,{title:"Produtos similares",items:s,brands:t,hierarchy:a,settings:r,theme:i,onProduct:oP})]})})}`;
source = source.slice(0, mjStart).concat(productModal, source.slice(mjEnd));

// Cards de similares usam callback do modal quando disponível; páginas completas continuam navegando.
replaceRequired(
  'function tT({title:e,items:t,brands:a,hierarchy:r,settings:n,theme:i})',
  'function tT({title:e,items:t,brands:a,hierarchy:r,settings:n,theme:i,onProduct:oP})',
  'assinatura de similares',
);
replaceRequired(
  'onClick:()=>window.location.assign(`/produto/${encodeURIComponent(String(o.id))}`)',
  'onClick:()=>oP?oP(o):window.location.assign(`/produto/${encodeURIComponent(String(o.id))}`)',
  'clique em similar',
);

// 5) Site público: controla abertura do catálogo/produto por eventos globais.
replaceRequired(
  '[f,y]=q.useState(_2),[x,k]=q.useState(null),[C,v]=q.useState("")',
  '[f,y]=q.useState(_2),[eO,eC]=q.useState(()=>window.location.hash==="#catalogo"||["departamento","secao","categoria","marca"].some(K=>new URLSearchParams(window.location.search).has(K))),[x,k]=q.useState(null),[C,v]=q.useState("")',
  'estado modal público',
);
replaceRequired(
  'window.removeEventListener("asteryon:notice",K),window.removeEventListener("asteryon:custom-action",Q)}},[]);const j=',
  'window.removeEventListener("asteryon:notice",K),window.removeEventListener("asteryon:custom-action",Q)}},[]),q.useEffect(()=>{const K=()=>eC(!0),Q=H=>{const ie=String((H.detail||{}).productId||""),U=a.find(ee=>String(ee.id)===ie||String(ee.code)===ie);U&&k(U)};return window.addEventListener("asteryon:catalog-open",K),window.addEventListener("asteryon:product-open",Q),()=>{window.removeEventListener("asteryon:catalog-open",K),window.removeEventListener("asteryon:product-open",Q)}},[a]);const j=',
  'eventos modais públicos',
);
replaceRequired(
  'l.jsx(gJ,{products:a,brands:n,hierarchy:o,settings:u,onProduct:k,theme:A})',
  'l.jsx(gJ,{products:a,brands:n,hierarchy:o,settings:u,onProduct:k,theme:A,open:eO,onClose:()=>eC(!1)})',
  'catálogo modal público',
);
replaceRequired(
  'x&&l.jsx(MJ,{product:x,brands:n,hierarchy:o,settings:u,onClose:()=>k(null),theme:A})',
  'x&&l.jsx(MJ,{product:x,products:a,brands:n,hierarchy:o,settings:u,onClose:()=>k(null),onProduct:k,theme:A})',
  'produto modal público',
);

// 6) Editor: remove o botão Menu artificial da V64. O drawer fica em um controlador
// invisível e os modais funcionam no Preview usando o catálogo vivo do Supabase.
const v64Canvas = 'l.jsxs("div",{"data-editor-menu-preview":"true",className:"relative flex min-h-0 flex-1 overflow-hidden",children:[l.jsx(mJ,{products:D.products,hierarchy:D.hierarchy,theme:k.theme||_2.theme,editorMode:!0}),l.jsx(Gj,{guides:r,setGuides:n})]})';
const plainCanvas = 'l.jsx("div",{className:"flex min-h-0 flex-1 overflow-hidden",children:l.jsx(Gj,{guides:r,setGuides:n})})';
if (source.includes(v64Canvas)) source = source.split(v64Canvas).join(plainCanvas);
if (source.includes('"data-editor-menu-preview":"true"')) throw new Error('V65: Menu artificial V64 ainda está no canvas.');

replaceRequired(
  'function NJ({cloudUser:e}){const{state:t,getNode:a}=Pa(),D=cn(),[r,n]=q.useState([]),',
  'function NJ({cloudUser:e}){const{state:t,getNode:a}=Pa(),D=cn(),[eO,eC]=q.useState(!1),[eP,eS]=q.useState(null),[r,n]=q.useState([]),',
  'estado modal do editor',
);
replaceRequired(
  'q.useEffect(()=>{if(!t.previewMode)return;',
  'q.useEffect(()=>{const b=()=>eC(!0),T=w=>{const j=String((w.detail||{}).productId||""),L=D.products.find(z=>String(z.id)===j||String(z.code)===j);L&&eS(L)};return window.addEventListener("asteryon:catalog-open",b),window.addEventListener("asteryon:product-open",T),()=>{window.removeEventListener("asteryon:catalog-open",b),window.removeEventListener("asteryon:product-open",T)}},[D.products]),q.useEffect(()=>{if(!t.previewMode)return;',
  'eventos modais do editor',
);
replaceRequired(
  'children:[l.jsx(PH,{}),!t.previewMode&&l.jsx(pJ,{})',
  'children:[l.jsx(mJ,{products:D.products,hierarchy:D.hierarchy,theme:k.theme||_2.theme,editorMode:!0}),l.jsx(gJ,{products:D.products,brands:D.brands,hierarchy:D.hierarchy,settings:D.settings,onProduct:eS,theme:k.theme||_2.theme,open:eO,onClose:()=>eC(!1)}),eP&&l.jsx(MJ,{product:eP,products:D.products,brands:D.brands,hierarchy:D.hierarchy,settings:D.settings,onClose:()=>eS(null),onProduct:eS,theme:k.theme||_2.theme}),l.jsx(PH,{}),!t.previewMode&&l.jsx(pJ,{})',
  'controladores no editor',
);

// 7) Textos legados remanescentes no painel de ações.
source = source.split('Produtos e marcas usam o cadastro real do D1').join('Produtos e marcas usam o cadastro real do Supabase');

if (source === original) {
  console.log('Patch V65 de catálogo/modal já aplicado.');
} else {
  await writeFile(assetPath, source);
  console.log('Patch V65 aplicado: catálogo e produto em modais; Menu controlado por elemento editável.');
}

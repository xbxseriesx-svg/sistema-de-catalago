import fs from 'node:fs';

const path = 'public/assets/index-V60Excel.js';
let source = fs.readFileSync(path, 'utf8');
const MARKER = 'ASTER_V81_CORE_PATCH';

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

function replaceAllExact(find, replacement, expected, label) {
  const count = source.split(find).length - 1;
  if (count !== expected) throw new Error(`Patch V81: ${label}: esperados ${expected}, encontrados ${count}`);
  source = source.split(find).join(replacement);
}

// 1) A mesma biblioteca de alinhamento/ações passa a ser comum a TODO objeto.
replaceOnce('l.jsx(cq,{node:e}),', '', 'remover ações exclusivas do inspetor de botão');
replaceOnce(
  'e.type==="breadcrumb"&&l.jsx(wq,{node:e,updateProp:d}),l.jsx(Cq,{node:e,updateStyle:s,update:o,mode:t})',
  'e.type==="breadcrumb"&&l.jsx(wq,{node:e,updateProp:d}),l.jsx(cq,{node:e}),l.jsx(Cq,{node:e,updateStyle:s,update:o,mode:t})',
  'inserir biblioteca comum no inspetor hq',
);
source = source.replace('["none","Nenhuma ação"]', '["none","Nenhum (padrão)"]');

// 2) Runtime público/preview: qualquer objeto com actionType configurado é clicável.
replaceOnce(
  'Q=I.type!=="none",H=e.type==="button"||e.type==="productbutton";',
  'Q=I.type!=="none",H=Q;',
  'habilitar ações em qualquer objeto no renderer',
);
replaceOnce(
  `'[data-node-type="button"],[data-node-type="button"] *,[data-node-type="productbutton"],[data-node-type="productbutton"] *{pointer-events:auto!important;cursor:pointer!important;}'`,
  `'[data-node-id]{pointer-events:auto!important}[data-node-id][data-asteryon-actionable="true"]{cursor:pointer!important}'`,
  'CSS de ações no preview',
);
replaceOnce(
  `'[data-node-type="button"],[data-node-type="productbutton"]'`,
  `'[data-node-id]'`,
  'delegação de clique no preview',
);

// 3) Regras: usa exatamente o mesmo componente cq dos Ajustes, sem catálogo paralelo.
const rulesComponent = `function V81Rules(){const{state:e,getNode:t}=Pa(),a=e.selectedIds[0],r=a?t(a):null;return l.jsxs("div",{className:"flex h-full flex-col bg-zinc-900",children:[l.jsxs("div",{className:"border-b border-zinc-800 p-3",children:[l.jsx("h3",{className:"text-xs font-semibold uppercase tracking-wider text-zinc-300",children:"Regras"}),l.jsx("p",{className:"mt-1 text-[10px] leading-relaxed text-zinc-500",children:"As regras usam a mesma biblioteca de ações dos Elementos e Ajustes. Nenhum é o padrão."})]}),l.jsx("div",{className:"flex-1 overflow-y-auto p-2",children:r?l.jsxs("div",{children:[l.jsxs("div",{className:"mb-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2",children:[l.jsx("div",{className:"text-[9px] uppercase tracking-wide text-zinc-500",children:"Elemento selecionado"}),l.jsx("div",{className:"mt-1 truncate text-[11px] font-semibold text-zinc-200",children:r.name||r.type})]}),l.jsx(cq,{node:r})]}):l.jsxs("div",{className:"rounded-xl border border-dashed border-zinc-700 p-4 text-center text-[11px] leading-relaxed text-zinc-500",children:["Selecione um elemento no canvas ou em Camadas para configurar sua regra.",l.jsx("br",{}),"Função ao clicar começa em Nenhum."]})})]})}`;
replaceOnce('function XY(){', `${rulesComponent}function XY(){`, 'componente Regras');
replaceOnce(
  'i==="offers"?l.jsx(A_,{}):l.jsx(XY,{})',
  'i==="offers"?l.jsx(A_,{}):i==="rules"?l.jsx(V81Rules,{}):l.jsx(XY,{})',
  'roteamento da aba Regras',
);
replaceAllExact(
  'l.jsx(ci,{active:i==="offers",onClick:()=>o("offers"),icon:l.jsx($r,{size:13}),label:"Ofertas"}),l.jsx(ci,{active:i==="history",onClick:()=>o("history"),icon:l.jsx($c,{size:13}),label:"Histórico"})',
  'l.jsx(ci,{active:i==="offers",onClick:()=>o("offers"),icon:l.jsx($r,{size:13}),label:"Ofertas"}),l.jsx(ci,{active:i==="rules",onClick:()=>o("rules"),icon:l.jsx(Jc,{size:13}),label:"Regras"}),l.jsx(ci,{active:i==="history",onClick:()=>o("history"),icon:l.jsx($c,{size:13}),label:"Histórico"})',
  1,
  'aba Regras expandida',
);
replaceAllExact(
  'l.jsx(Or,{onClick:()=>{d(!0),o("offers")},title:"Ofertas",children:l.jsx($r,{size:16})}),l.jsx(Or,{onClick:()=>{d(!0),o("history")},title:"Histórico",children:l.jsx($c,{size:16})})',
  'l.jsx(Or,{onClick:()=>{d(!0),o("offers")},title:"Ofertas",children:l.jsx($r,{size:16})}),l.jsx(Or,{onClick:()=>{d(!0),o("rules")},title:"Regras",children:l.jsx(Jc,{size:16})}),l.jsx(Or,{onClick:()=>{d(!0),o("history")},title:"Histórico",children:l.jsx($c,{size:16})})',
  1,
  'aba Regras recolhida',
);

// 4) Marketing > Carrossel: preserva imagens e acrescenta Apenas Marcas / Produtos.
replaceOnce(
  'carousel:{active:!1,speed:1,loop:!0,autoplay:!0,manual:!0,items:[]}',
  'carousel:{active:!1,speed:1,loop:!0,autoplay:!0,manual:!0,mode:"images",selectionMode:"multiple",selectedBrandIds:[],selectedProductIds:[],items:[]}',
  'defaults do carrossel',
);

const carouselHelpers = `function V81CarouselCount(e){const t=(e==null?void 0:e.mode)||"images";return t==="brands"?Array.isArray(e==null?void 0:e.selectedBrandIds)?e.selectedBrandIds.length:0:t==="products"?Array.isArray(e==null?void 0:e.selectedProductIds)?e.selectedProductIds.length:0:Array.isArray(e==null?void 0:e.items)?e.items.length:0}function V81CarouselRenderer({config:e,theme:t}){const a=cn(),r=(e==null?void 0:e.mode)||"images",n=r==="brands"?(e.selectedBrandIds||[]).map(s=>a.brands.find(d=>String(d.id)===String(s))).filter(Boolean):r==="products"?(e.selectedProductIds||[]).map(s=>a.products.find(d=>String(d.id)===String(s))).filter(Boolean):[];const[i,o]=q.useState(0);q.useEffect(()=>{i>=n.length&&o(0)},[i,n.length]),q.useEffect(()=>{if(r==="images"||!e.autoplay||n.length<2)return;const s=window.setInterval(()=>o(d=>e.loop?(d+1)%n.length:Math.min(d+1,n.length-1)),Math.max(1200,5e3/Math.max(.5,Number(e.speed)||1)));return()=>window.clearInterval(s)},[r,e.autoplay,e.loop,e.speed,n.length]);if(r==="images")return l.jsx(DY,{config:e,theme:t});const s=n[i];if(!s)return null;const d=()=>o(h=>h<=0?e.loop?n.length-1:0:h-1),h=()=>o(u=>u>=n.length-1?e.loop?0:u:u+1);let u=null;if(r==="brands"){const p=String(s.logoUrl||s.logo_url||s.logo||"");u=l.jsx("a",{href:`/marca/${encodeURIComponent(s.slug||s.id||"")}`,className:"flex h-[220px] w-full items-center justify-center bg-white p-8",children:p?l.jsx("img",{src:p,alt:String(s.name||"Marca"),className:"max-h-full max-w-full object-contain"}):l.jsx("div",{className:"text-xs text-zinc-400",children:"Marca sem logo"})})}else{const p=String(s.image||s.imageUrl||s.image_url||""),f=String(s.shortDescription||s.name||s.description||"Produto"),y=String(s.id||s.code||"");u=l.jsxs("a",{href:`/produto/${encodeURIComponent(y)}`,className:"mx-auto grid min-h-[280px] w-full max-w-lg grid-cols-[150px_1fr] items-center gap-5 p-6 text-left no-underline",style:{color:t.text},children:[l.jsx("div",{className:"flex h-48 items-center justify-center overflow-hidden rounded-xl bg-white p-2",children:p?l.jsx("img",{src:p,alt:f,className:"max-h-full max-w-full object-contain"}):l.jsx("span",{className:"text-[10px] text-zinc-400",children:"SEM IMAGEM"})}),l.jsxs("div",{children:[l.jsx("div",{className:"text-xs font-bold uppercase opacity-50",children:a.brandName(s.brandId)}),l.jsx("div",{className:"mt-2 text-xl font-black",children:f}),s.code&&l.jsxs("div",{className:"mt-2 text-xs opacity-60",children:["Código ",s.code]}),l.jsx("div",{className:"mt-4 text-sm font-bold",style:{color:t.primary},children:"Abrir detalhes →"})]})]})}return l.jsxs("section",{className:"relative overflow-hidden",style:{background:t.surface},children:[u,e.manual&&n.length>1&&l.jsxs(l.Fragment,{children:[l.jsx("button",{"aria-label":"Anterior",onClick:d,className:"absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-white shadow",style:{background:`${t.primary}dd`},children:l.jsx(fl,{size:24})}),l.jsx("button",{"aria-label":"Próximo",onClick:h,className:"absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-white shadow",style:{background:`${t.primary}dd`},children:l.jsx(Tr,{size:24})})]}),n.length>1&&l.jsx("div",{className:"absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1",children:n.map((p,f)=>l.jsx("button",{"aria-label":`Item ${f+1}`,onClick:()=>o(f),className:"h-2.5 w-2.5 rounded-full border border-white/70",style:{background:f===i?t.primary:"rgba(255,255,255,.45)"}},String(p.id||f)))})]})}function V81CarouselEditor({config:e,patch:t,upload:a,busy:r,move:n,remove:i}){const o=e.carousel||{},s=(o.mode||"images"),d=cn(),[h,u]=q.useState(""),[p,f]=q.useState("all"),[y,x]=q.useState(o.selectionMode||"multiple"),[k,C]=q.useState(()=>new Set((s==="brands"?o.selectedBrandIds:o.selectedProductIds)||[]));q.useEffect(()=>{C(new Set((s==="brands"?o.selectedBrandIds:o.selectedProductIds)||[])),u(""),f("all")},[s,(o.selectedBrandIds||[]).join("|"),(o.selectedProductIds||[]).join("|")]);const v=A=>{t("carousel",{mode:A}),C(new Set((A==="brands"?o.selectedBrandIds:o.selectedProductIds)||[])),u(""),f("all")};if(s==="images")return l.jsxs("div",{children:[l.jsx(tA,{icon:l.jsx(Ho,{size:12}),text:"Modalidade de exibição"}),l.jsxs("select",{className:ur,value:s,onChange:A=>v(A.target.value),children:[l.jsx("option",{value:"images",children:"Imagens"}),l.jsx("option",{value:"brands",children:"Apenas Marcas"}),l.jsx("option",{value:"products",children:"Produtos"})]}),l.jsx("div",{className:"mt-3",children:l.jsx(HY,{config:e,patch:t,upload:a,busy:r,move:n,remove:i})})]});const g=s==="brands",m=g?d.brands:d.products,S=String(h||"").toLowerCase(),b=d.hierarchy.filter(A=>A.level==="departamento"&&A.status!=="inactive"),T=m.filter(A=>{const E=g?`${A.name||""} ${A.slug||""}`:`${A.code||""} ${A.shortDescription||A.name||""} ${d.brandName(A.brandId)||""}`;if(S&&!E.toLowerCase().includes(S))return!1;if(p==="all")return!0;if(g){const U=!!String(A.logoUrl||A.logo_url||A.logo||"");return p==="with-logo"?U:!U}return String(A.departamentoId||"")===String(p)}),w=[...k].map(A=>m.find(E=>String(E.id)===String(A))).filter(Boolean),j=A=>{C(E=>{const U=new Set(E),ee=String(A);return y==="single"?(U.clear(),U.add(ee)):U.has(ee)?U.delete(ee):U.add(ee),U})},L=A=>C(E=>{const U=new Set(E);return U.delete(String(A)),U}),z=()=>{const A=[...k];t("carousel",g?{mode:s,selectionMode:y,selectedBrandIds:A}:{mode:s,selectionMode:y,selectedProductIds:A})};return l.jsxs("div",{children:[l.jsx(tA,{icon:l.jsx(Ho,{size:12}),text:"Carrossel"}),l.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[l.jsx(ba,{label:"Ativo",value:!!o.active,onChange:A=>t("carousel",{active:A})}),l.jsxs("select",{className:ur,value:String(o.speed||1),onChange:A=>t("carousel",{speed:Number(A.target.value)}),children:[l.jsx("option",{value:"1",children:"1x"}),l.jsx("option",{value:"1.5",children:"1,5x"}),l.jsx("option",{value:"2",children:"2x"})]})]}),l.jsxs("div",{className:"mt-2 grid grid-cols-3 gap-1",children:[l.jsx(ba,{label:"Loop",value:o.loop!==!1,onChange:A=>t("carousel",{loop:A})}),l.jsx(ba,{label:"Auto",value:o.autoplay!==!1,onChange:A=>t("carousel",{autoplay:A})}),l.jsx(ba,{label:"Manual",value:!!o.manual,onChange:A=>t("carousel",{manual:A})})]}),l.jsx("div",{className:"mt-3 text-[9px] font-bold uppercase text-zinc-500",children:"Modalidade de exibição"}),l.jsxs("select",{className:ur,value:s,onChange:A=>v(A.target.value),children:[l.jsx("option",{value:"images",children:"Imagens"}),l.jsx("option",{value:"brands",children:"Apenas Marcas"}),l.jsx("option",{value:"products",children:"Produtos"})]}),l.jsx("div",{className:"mt-3 text-[9px] font-bold uppercase text-zinc-500",children:"Seleção"}),l.jsxs("select",{className:ur,value:y,onChange:A=>{const E=A.target.value;x(E),E==="single"&&C(U=>new Set([...U].slice(0,1)))},children:[l.jsx("option",{value:"multiple",children:"Múltipla"}),l.jsx("option",{value:"single",children:"Única"})]}),l.jsx("input",{className:`${ur} mt-2`,value:h,onChange:A=>u(A.target.value),placeholder:g?"Buscar marca...":"Buscar código, produto ou marca..."}),g?l.jsxs("select",{className:`${ur} mt-2`,value:p,onChange:A=>f(A.target.value),children:[l.jsx("option",{value:"all",children:"Todas as marcas"}),l.jsx("option",{value:"with-logo",children:"Somente com logo"}),l.jsx("option",{value:"without-logo",children:"Sem logo"})]}):l.jsxs("select",{className:`${ur} mt-2`,value:p,onChange:A=>f(A.target.value),children:[l.jsx("option",{value:"all",children:"Todos os departamentos"}),b.map(A=>l.jsx("option",{value:A.id,children:A.name},A.id))]}),l.jsx("div",{className:"mt-2 max-h-64 space-y-1 overflow-y-auto",children:T.length?T.map(A=>{const E=k.has(String(A.id)),U=g?String(A.logoUrl||A.logo_url||A.logo||""):String(A.image||A.imageUrl||"");return l.jsxs("label",{className:`flex cursor-pointer items-center gap-2 rounded border p-2 ${E?"border-pink-500/50 bg-pink-500/10":"border-zinc-800 bg-zinc-950/60"}`,children:[l.jsx("input",{type:"checkbox",checked:E,onChange:()=>j(A.id),className:"accent-pink-500"}),U?l.jsx("img",{src:U,alt:"",className:"h-9 w-11 shrink-0 rounded bg-white object-contain p-0.5"}):l.jsx("div",{className:"grid h-9 w-11 shrink-0 place-items-center rounded bg-zinc-800 text-[7px] text-zinc-500",children:"SEM IMG"}),l.jsxs("div",{className:"min-w-0 flex-1",children:[l.jsx("div",{className:"truncate text-[10px] font-semibold text-zinc-200",children:g?A.name:`${A.code||""} · ${A.shortDescription||A.name||"Produto"}`}),!g&&l.jsx("div",{className:"truncate text-[9px] text-zinc-500",children:d.brandName(A.brandId)})]})]},A.id)}):l.jsx("div",{className:"rounded border border-dashed border-zinc-700 p-3 text-center text-[9px] text-zinc-500",children:"Nenhum item encontrado com os filtros atuais."})}),l.jsxs("div",{className:"mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2",children:[l.jsxs("div",{className:"mb-2 flex items-center justify-between",children:[l.jsx("span",{className:"text-[9px] font-bold uppercase text-zinc-400",children:"Selecionados"}),l.jsxs("span",{className:"text-[9px] font-bold text-pink-300",children:[k.size," selecionado(s)"]})]}),w.length?l.jsx("div",{className:"space-y-1",children:w.map(A=>l.jsxs("div",{className:"flex items-center gap-2 rounded border border-zinc-800 px-2 py-1.5",children:[l.jsx("span",{className:"min-w-0 flex-1 truncate text-[9px] text-zinc-300",children:g?A.name:`${A.code||""} · ${A.shortDescription||A.name||"Produto"}`}),l.jsx("button",{onClick:()=>L(A.id),className:"text-[9px] font-semibold text-red-400",children:"Remover"})]},A.id))}):l.jsx("div",{className:"text-[9px] text-zinc-600",children:"Nenhum item selecionado."}),l.jsxs("button",{onClick:z,className:"mt-2 flex w-full items-center justify-center gap-1 rounded bg-pink-600 py-2 text-[10px] font-bold text-white",children:["Confirmar seleção · ",k.size]})]})]})}`;
replaceOnce('function _I({config:e})', `${carouselHelpers}function _I({config:e})`, 'helpers de carrossel V81');
replaceOnce(
  'r.active&&r.items.length>0&&l.jsx(DY,{config:r,theme:n})',
  'r.active&&V81CarouselCount(r)>0&&l.jsx(V81CarouselRenderer,{config:r,theme:n})',
  'renderer de carrossel por modalidade',
);
replaceOnce(
  'n==="carousel"&&l.jsx(HY,{config:e,patch:y,upload:v,busy:o,move:g,remove:m})',
  'n==="carousel"&&l.jsx(V81CarouselEditor,{config:e,patch:y,upload:v,busy:o,move:g,remove:m})',
  'editor de carrossel por modalidade',
);
replaceAllExact(
  'e.carousel.active&&e.carousel.items.length>0',
  'e.carousel.active&&V81CarouselCount(e.carousel)>0',
  1,
  'visibilidade da prévia de Marketing',
);
replaceAllExact(
  'k.carousel.active&&k.carousel.items.length>0',
  'k.carousel.active&&V81CarouselCount(k.carousel)>0',
  1,
  'visibilidade do Marketing no editor',
);

// Marca o bundle para idempotência e auditoria.
source = source.replace('function DJ(){', `const ${MARKER}=true;function DJ(){`);
fs.writeFileSync(path, source);
console.log('Patch V81 aplicado: ações universais, Regras e carrossel Marcas/Produtos.');

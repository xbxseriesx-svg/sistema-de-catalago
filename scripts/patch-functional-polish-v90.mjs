import fs from 'node:fs';

const path = 'public/assets/index-V60Excel.js';
const MARKER = 'ASTER_V90_FUNCTIONAL_POLISH';
let source = fs.readFileSync(path, 'utf8');

if (source.includes(MARKER)) {
  console.log('Polimento funcional V90 já materializado no bundle.');
  process.exit(0);
}

function replaceOnce(find, replacement, label) {
  const first = source.indexOf(find);
  if (first < 0) throw new Error(`V90: trecho não encontrado: ${label}`);
  if (source.indexOf(find, first + find.length) >= 0) throw new Error(`V90: trecho duplicado inesperadamente: ${label}`);
  source = source.slice(0, first) + replacement + source.slice(first + find.length);
}

// O backend/importador aceita departamentos dinâmicos. O editor manual não pode
// limitar o produto a dois nomes fixos, senão um departamento criado pelo Excel
// fica impossível de selecionar/regravar pelo formulário de produto.
replaceOnce(
  'children:[l.jsx("option",{children:"Atacado"}),l.jsx("option",{children:"Distribuição"})]',
  'children:ee.length?ee.map(M=>l.jsx("option",{value:M.name,children:M.name},M.id)):[l.jsx("option",{value:"Atacado",children:"Atacado"}),l.jsx("option",{value:"Distribuição",children:"Distribuição"})]',
  'seletor dinâmico de Departamento no produto',
);

// A tela Estrutura declarava Departamento → Seção → Categoria → Produto, mas
// permitia criar apenas seção/categoria. Completa o CRUD manual de Departamento.
replaceOnce(
  'if(!o.trim())return p("Informe o nome.");if(!d&&!n)return p(a==="secao"?"Selecione o departamento superior.":"Selecione a seção superior.");',
  'if(!o.trim())return p("Informe o nome.");if(!d&&a!=="departamento"&&!n)return p(a==="secao"?"Selecione o departamento superior.":"Selecione a seção superior.");',
  'validação de pai no formulário de hierarquia',
);
replaceOnce(
  'await Be.createHierarchy({level:a,name:o.trim(),parentId:n,sortOrder:100})',
  'await Be.createHierarchy({level:a,name:o.trim(),parentId:a==="departamento"?"":n,sortOrder:100})',
  'criação de departamento sem pai',
);
replaceOnce(
  'T=a==="secao"?x:k;',
  'T=a==="departamento"?[]:a==="secao"?x:k;',
  'fonte de pais por nível',
);
replaceOnce(
  'className:"grid grid-cols-2 gap-2",children:[l.jsx("button",{disabled:!!d,onClick:()=>{r("secao"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="secao"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Nova seção"}),l.jsx("button",{disabled:!!d,onClick:()=>{r("categoria"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="categoria"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Nova categoria"})]',
  'className:"grid grid-cols-3 gap-2",children:[l.jsx("button",{disabled:!!d,onClick:()=>{r("departamento"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="departamento"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Novo departamento"}),l.jsx("button",{disabled:!!d,onClick:()=>{r("secao"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="secao"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Nova seção"}),l.jsx("button",{disabled:!!d,onClick:()=>{r("categoria"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="categoria"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Nova categoria"})]',
  'botões de criação da estrutura',
);
replaceOnce(
  '!d&&l.jsxs(l.Fragment,{children:[l.jsxs("label",{className:"mb-1 mt-3 block text-[9px] text-zinc-500",children:[a==="secao"?"Departamento":"Seção"," superior"]})',
  '!d&&a!=="departamento"&&l.jsxs(l.Fragment,{children:[l.jsxs("label",{className:"mb-1 mt-3 block text-[9px] text-zinc-500",children:[a==="secao"?"Departamento":"Seção"," superior"]})',
  'ocultar seletor de pai para departamento',
);
replaceOnce(
  'placeholder:a==="secao"?"Ex.: Bebidas":"Ex.: Refrigerante"',
  'placeholder:a==="departamento"?"Ex.: Food Service":a==="secao"?"Ex.: Bebidas":"Ex.: Refrigerante"',
  'placeholder por nível da hierarquia',
);
replaceOnce(
  'l.jsx("div",{className:"text-[10px] font-black uppercase tracking-wide text-blue-300",children:w.name})',
  'l.jsx(QF,{node:w,count:w.sections.length,onEdit:S,onDelete:b})',
  'ações de editar/excluir departamento',
);

// Textos técnicos antigos apareciam para o usuário mesmo depois da migração
// definitiva D1/Lovable/Bolt -> Supabase/ASTERYON.
replaceOnce(
  'Dados do Lovable dentro do canvas Bolt',
  'Dados do Supabase dentro do editor ASTERYON',
  'descrição do painel Catálogo',
);
replaceOnce(
  'Modelo convertido do protótipo Figma, com produtos e estrutura ligados ao D1.',
  'Modelo convertido do protótipo Figma, com produtos e estrutura ligados ao Supabase.',
  'descrição Distribuidora União',
);
replaceOnce(
  'Vitrine comercial moderna vinculada aos produtos já cadastrados no D1.',
  'Vitrine comercial moderna vinculada aos produtos já cadastrados no Supabase.',
  'descrição Vitrine Atacado Pro',
);

// Marca a materialização para que o build seja idempotente.
replaceOnce(
  'const ASTER_V81_WHITE_SCREEN_FIX=true,ASTER_V81_CORE_PATCH=true;',
  `const ASTER_V81_WHITE_SCREEN_FIX=true,ASTER_V81_CORE_PATCH=true,${MARKER}=true;`,
  'marcador funcional V90',
);

fs.writeFileSync(path, source);
console.log('Polimento funcional V90 aplicado: departamentos dinâmicos, CRUD completo da estrutura e textos técnicos normalizados.');

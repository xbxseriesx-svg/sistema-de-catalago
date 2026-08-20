import fs from 'node:fs';

const path = 'public/assets/index-V60Excel.js';
const MARKER = 'ASTER_V90_FUNCTIONAL_POLISH';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

function ensureReplacement(find, replacement, desired, label) {
  if (source.includes(desired)) {
    console.log(`V90: ${label} já está materializado.`);
    return;
  }
  const first = source.indexOf(find);
  if (first < 0) throw new Error(`V90: trecho não encontrado e estado desejado ausente: ${label}`);
  if (source.indexOf(find, first + find.length) >= 0) throw new Error(`V90: trecho duplicado inesperadamente: ${label}`);
  source = source.slice(0, first) + replacement + source.slice(first + find.length);
  changed = true;
}

// NÃO usar o marcador da release como critério para pular correções. O bundle
// histórico pode carregar o marcador V90 e ainda conter um trecho antigo.
// Cada transformação abaixo comprova o estado desejado individualmente.
ensureReplacement(
  'children:[l.jsx("option",{children:"Atacado"}),l.jsx("option",{children:"Distribuição"})]',
  'children:ee.length?ee.map(M=>l.jsx("option",{value:M.name,children:M.name},M.id)):[l.jsx("option",{value:"Atacado",children:"Atacado"}),l.jsx("option",{value:"Distribuição",children:"Distribuição"})]',
  'children:ee.length?ee.map(M=>l.jsx("option",{value:M.name,children:M.name},M.id))',
  'seletor dinâmico de Departamento no produto',
);

ensureReplacement(
  'if(!o.trim())return p("Informe o nome.");if(!d&&!n)return p(a==="secao"?"Selecione o departamento superior.":"Selecione a seção superior.");',
  'if(!o.trim())return p("Informe o nome.");if(!d&&a!=="departamento"&&!n)return p(a==="secao"?"Selecione o departamento superior.":"Selecione a seção superior.");',
  'if(!o.trim())return p("Informe o nome.");if(!d&&a!=="departamento"&&!n)',
  'validação de pai no formulário de hierarquia',
);
ensureReplacement(
  'await Be.createHierarchy({level:a,name:o.trim(),parentId:n,sortOrder:100})',
  'await Be.createHierarchy({level:a,name:o.trim(),parentId:a==="departamento"?"":n,sortOrder:100})',
  'parentId:a==="departamento"?"":n',
  'criação de departamento sem pai',
);
ensureReplacement(
  'T=a==="secao"?x:k;',
  'T=a==="departamento"?[]:a==="secao"?x:k;',
  'T=a==="departamento"?[]:a==="secao"?x:k;',
  'fonte de pais por nível',
);
ensureReplacement(
  'className:"grid grid-cols-2 gap-2",children:[l.jsx("button",{disabled:!!d,onClick:()=>{r("secao"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="secao"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Nova seção"}),l.jsx("button",{disabled:!!d,onClick:()=>{r("categoria"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="categoria"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Nova categoria"})]',
  'className:"grid grid-cols-3 gap-2",children:[l.jsx("button",{disabled:!!d,onClick:()=>{r("departamento"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="departamento"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Novo departamento"}),l.jsx("button",{disabled:!!d,onClick:()=>{r("secao"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="secao"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Nova seção"}),l.jsx("button",{disabled:!!d,onClick:()=>{r("categoria"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="categoria"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Nova categoria"})]',
  'children:"Novo departamento"',
  'botões de criação da estrutura',
);
ensureReplacement(
  '!d&&l.jsxs(l.Fragment,{children:[l.jsxs("label",{className:"mb-1 mt-3 block text-[9px] text-zinc-500",children:[a==="secao"?"Departamento":"Seção"," superior"]})',
  '!d&&a!=="departamento"&&l.jsxs(l.Fragment,{children:[l.jsxs("label",{className:"mb-1 mt-3 block text-[9px] text-zinc-500",children:[a==="secao"?"Departamento":"Seção"," superior"]})',
  '!d&&a!=="departamento"&&l.jsxs(l.Fragment',
  'ocultar seletor de pai para departamento',
);
ensureReplacement(
  'placeholder:a==="secao"?"Ex.: Bebidas":"Ex.: Refrigerante"',
  'placeholder:a==="departamento"?"Ex.: Food Service":a==="secao"?"Ex.: Bebidas":"Ex.: Refrigerante"',
  'placeholder:a==="departamento"?"Ex.: Food Service"',
  'placeholder por nível da hierarquia',
);
ensureReplacement(
  'l.jsx("div",{className:"text-[10px] font-black uppercase tracking-wide text-blue-300",children:w.name})',
  'l.jsx(QF,{node:w,count:w.sections.length,onEdit:S,onDelete:b})',
  'l.jsx(QF,{node:w,count:w.sections.length,onEdit:S,onDelete:b})',
  'ações de editar/excluir departamento',
);

ensureReplacement(
  'Dados do Lovable dentro do canvas Bolt',
  'Dados do Supabase dentro do editor ASTERYON',
  'Dados do Supabase dentro do editor ASTERYON',
  'descrição do painel Catálogo',
);
ensureReplacement(
  'Modelo convertido do protótipo Figma, com produtos e estrutura ligados ao D1.',
  'Modelo convertido do protótipo Figma, com produtos e estrutura ligados ao Supabase.',
  'Modelo convertido do protótipo Figma, com produtos e estrutura ligados ao Supabase.',
  'descrição Distribuidora União',
);
ensureReplacement(
  'Vitrine comercial moderna vinculada aos produtos já cadastrados no D1.',
  'Vitrine comercial moderna vinculada aos produtos já cadastrados no Supabase.',
  'Vitrine comercial moderna vinculada aos produtos já cadastrados no Supabase.',
  'descrição Vitrine Atacado Pro',
);

if (!source.includes(MARKER)) {
  ensureReplacement(
    'const ASTER_V81_WHITE_SCREEN_FIX=true,ASTER_V81_CORE_PATCH=true;',
    `const ASTER_V81_WHITE_SCREEN_FIX=true,ASTER_V81_CORE_PATCH=true,${MARKER}=true;`,
    `${MARKER}=true`,
    'marcador funcional V90',
  );
}

if (changed) fs.writeFileSync(path, source);
console.log(changed
  ? 'Polimento funcional V90 materializado/corrigido por transformação.'
  : 'Polimento funcional V90 validado: todas as transformações já estavam presentes.');

import { readFile, writeFile } from 'node:fs/promises';

const path = 'public/assets/index-V60Excel.js';
const marker = 'ASTER_V89_HIERARCHY_CRUD';
let source = await readFile(path, 'utf8');

if (source.includes(marker)) {
  console.log('Patch V89 de hierarquia já materializado.');
  process.exit(0);
}

function replaceOnce(from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Patch V89 hierarquia: trecho não encontrado (${label}).`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Patch V89 hierarquia: trecho ambíguo (${label}).`);
  source = `${source.slice(0, first)}${to}${source.slice(first + from.length)}`;
}

replaceOnce(
  'function FY(){const e=cn(),t=e.hierarchy.filter(w=>w.status!=="inactive"),[a,r]=q.useState("secao")',
  'function FY(){const e=cn(),t=e.hierarchy.filter(w=>w.status!=="inactive"),[a,r]=q.useState("departamento")',
  'nível inicial',
);

replaceOnce(
  'if(!d&&!n)return p(a==="secao"?"Selecione o departamento superior.":"Selecione a seção superior.");',
  'if(!d&&a!=="departamento"&&!n)return p(a==="secao"?"Selecione o departamento superior.":"Selecione a seção superior.");',
  'validação de pai',
);

replaceOnce(
  'T=a==="secao"?x:k;return l.jsxs("div"',
  'T=a==="secao"?x:a==="categoria"?k:[];return l.jsxs("div"',
  'lista de pais',
);

replaceOnce(
  'className:"grid grid-cols-2 gap-2",children:[l.jsx("button",{disabled:!!d,onClick:()=>{r("secao"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="secao"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Nova seção"}),l.jsx("button",{disabled:!!d,onClick:()=>{r("categoria"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="categoria"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Nova categoria"})]',
  'className:"grid grid-cols-3 gap-2",children:[l.jsx("button",{disabled:!!d,onClick:()=>{r("departamento"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="departamento"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Novo departamento"}),l.jsx("button",{disabled:!!d,onClick:()=>{r("secao"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="secao"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Nova seção"}),l.jsx("button",{disabled:!!d,onClick:()=>{r("categoria"),i("")},className:`rounded py-2 text-[9px] font-bold ${a==="categoria"?"bg-emerald-600 text-white":"bg-zinc-800 text-zinc-500"}`,children:"Nova categoria"})]',
  'botões de nível',
);

replaceOnce(
  '!d&&l.jsxs(l.Fragment,{children:[l.jsxs("label",{className:"mb-1 mt-3 block text-[9px] text-zinc-500",children:[a==="secao"?"Departamento":"Seção"," superior"]})',
  '!d&&a!=="departamento"&&l.jsxs(l.Fragment,{children:[l.jsxs("label",{className:"mb-1 mt-3 block text-[9px] text-zinc-500",children:[a==="secao"?"Departamento":"Seção"," superior"]})',
  'seletor de pai',
);

replaceOnce(
  'placeholder:a==="secao"?"Ex.: Bebidas":"Ex.: Refrigerante"',
  'placeholder:a==="departamento"?"Ex.: Food Service":a==="secao"?"Ex.: Bebidas":"Ex.: Refrigerante"',
  'placeholder por nível',
);

replaceOnce(
  'l.jsx("div",{className:"text-[10px] font-black uppercase tracking-wide text-blue-300",children:w.name}),w.sections.length===0',
  'l.jsx(QF,{node:w,count:w.sections.length,onEdit:S,onDelete:b}),w.sections.length===0',
  'ações do Departamento',
);

source += `\n/* ${marker} */\n`;
await writeFile(path, source);
console.log('Patch V89 de hierarquia materializado: Departamento, Seção e Categoria editáveis.');

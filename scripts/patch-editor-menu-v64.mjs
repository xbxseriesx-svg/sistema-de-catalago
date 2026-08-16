import { readFile, writeFile } from 'node:fs/promises';

const assetPath = 'public/assets/index-V60Excel.js';
const original = await readFile(assetPath, 'utf8');
let source = original;

// V64: o menu público também precisa ser renderizado dentro do canvas do editor.
// Mantemos um único componente e apenas mudamos fixed -> absolute quando ele está
// dentro do canvas, evitando duplicação visual no site publicado.
const oldMenuSignature = 'function mJ({products:e,hierarchy:t,theme:a}){const[r,n]=q.useState(!1),';
const newMenuSignature = 'function mJ({products:e,hierarchy:t,theme:a,editorMode:eM=!1}){const[r,n]=q.useState(!1),';
if (source.includes(oldMenuSignature)) {
  source = source.replace(oldMenuSignature, newMenuSignature);
} else if (!source.includes(newMenuSignature)) {
  throw new Error('Componente Menu incompatível com o patch V64.');
}

const menuStart = source.indexOf('function mJ({products:e,hierarchy:t,theme:a,editorMode:eM=!1})');
const menuEnd = source.indexOf('function gJ(', menuStart);
if (menuStart < 0 || menuEnd < 0) throw new Error('Não foi possível isolar o componente Menu V64.');
let menu = source.slice(menuStart, menuEnd);

menu = menu.replace(
  'className:"fixed left-3 top-3 z-[999990] flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-white shadow-xl"',
  'className:`${eM?"absolute":"fixed"} left-3 top-3 z-[999990] flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-white shadow-xl`',
);
menu = menu.replace(
  'className:"fixed inset-0 z-[999995] bg-black/55"',
  'className:`${eM?"absolute":"fixed"} inset-0 z-[999995] bg-black/55`',
);

// No editor, os links do drawer não podem tirar o usuário da tela de edição.
menu = menu.replace(
  'href:"/#catalogo",onClick:()=>n(!1)',
  'href:eM?"#":"/#catalogo",onClick:o=>{eM?o.preventDefault():n(!1)}',
);
menu = menu.replace(
  'href:`/?categoria=${encodeURIComponent(d.id)}#catalogo`,onClick:()=>n(!1)',
  'href:eM?"#":`/?categoria=${encodeURIComponent(d.id)}#catalogo`,onClick:o=>{eM?o.preventDefault():n(!1)}',
);
menu = menu.replace(
  'href:`/produto/${encodeURIComponent(String(u.id))}`,className:',
  'href:eM?"#":`/produto/${encodeURIComponent(String(u.id))}`,onClick:o=>{if(eM)o.preventDefault()},className:',
);

if (!menu.includes('${eM?"absolute":"fixed"} left-3 top-3')) {
  throw new Error('Posicionamento editor/public do Menu não foi aplicado.');
}
source = source.slice(0, menuStart).concat(menu, source.slice(menuEnd));

// O CatalogProvider já envolve o editor, então o NJ pode usar exatamente o mesmo
// catálogo vivo do Supabase para preencher Departamento > Seção > Categoria.
const oldEditorIntro = 'function NJ({cloudUser:e}){const{state:t,getNode:a}=Pa(),[r,n]=q.useState([]),';
const newEditorIntro = 'function NJ({cloudUser:e}){const{state:t,getNode:a}=Pa(),D=cn(),[r,n]=q.useState([]),';
if (source.includes(oldEditorIntro)) {
  source = source.replace(oldEditorIntro, newEditorIntro);
} else if (!source.includes(newEditorIntro)) {
  throw new Error('Editor NJ incompatível com o patch V64.');
}

const oldCanvas = 'l.jsx("div",{className:"flex min-h-0 flex-1 overflow-hidden",children:l.jsx(Gj,{guides:r,setGuides:n})})';
const newCanvas = 'l.jsxs("div",{"data-editor-menu-preview":"true",className:"relative flex min-h-0 flex-1 overflow-hidden",children:[l.jsx(mJ,{products:D.products,hierarchy:D.hierarchy,theme:k.theme||_2.theme,editorMode:!0}),l.jsx(Gj,{guides:r,setGuides:n})]})';
const occurrences = source.split(oldCanvas).length - 1;
if (occurrences > 0) source = source.split(oldCanvas).join(newCanvas);

const patchedOccurrences = source.split('"data-editor-menu-preview":"true"').length - 1;
if (patchedOccurrences !== 2) {
  throw new Error(`Esperados 2 pontos do canvas com Menu V64; encontrados ${patchedOccurrences}.`);
}

if (source === original) {
  console.log('Patch V64 do Menu no editor já aplicado.');
} else {
  await writeFile(assetPath, source);
  console.log('Patch V64 do Menu no editor aplicado em edição e Preview.');
}

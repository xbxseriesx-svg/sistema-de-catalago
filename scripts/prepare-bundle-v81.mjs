import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const bundlePath = 'public/assets/index-V60Excel.js';
const marker = 'ASTER_V81_CORE_PATCH';
const whiteScreenMarker = 'ASTER_V81_WHITE_SCREEN_FIX';
const performanceMarker = 'ASTER_V86_EDITOR_PERFORMANCE';
const hierarchyMarker = 'ASTER_V89_HIERARCHY_CRUD';

// O Modelo Oficial é fonte auxiliar independente do bundle e precisa permanecer
// normalizado mesmo quando o bundle V81 já está materializado.
execFileSync(process.execPath, ['scripts/patch-modelo-oficial-v81.mjs'], { stdio: 'inherit' });

let bundle = await readFile(bundlePath, 'utf8');
if (!bundle.includes(marker)) {
  const patches = [
    'scripts/patch-importer-v60.mjs',
    'scripts/patch-editor-menu-v64.mjs',
    'scripts/patch-catalog-modal-v65.mjs',
    'scripts/patch-responsive-v67.mjs',
    'scripts/patch-brand-laurencini-v68.mjs',
    'scripts/patch-system-v81.mjs',
  ];

  for (const patch of patches) execFileSync(process.execPath, [patch], { stdio: 'inherit' });
  bundle = await readFile(bundlePath, 'utf8');
  if (!bundle.includes(marker)) throw new Error('Cadeia V81 terminou sem materializar o marcador final.');
  console.log('Cadeia completa de patches V81 aplicada com sucesso.');
} else {
  console.log('Bundle V81 já materializado: cadeia legada não será reaplicada.');
}

bundle = await readFile(bundlePath, 'utf8');
if (!bundle.includes(whiteScreenMarker)) execFileSync(process.execPath, ['scripts/patch-white-screen-v81.mjs'], { stdio: 'inherit' });
bundle = await readFile(bundlePath, 'utf8');
if (!bundle.includes(whiteScreenMarker)) throw new Error('Hotfix V81 de tela branca não foi materializado.');

if (!bundle.includes(performanceMarker)) execFileSync(process.execPath, ['scripts/patch-editor-performance-v86.mjs'], { stdio: 'inherit' });
bundle = await readFile(bundlePath, 'utf8');
if (!bundle.includes(performanceMarker)) throw new Error('Hotfix V86 de performance não foi materializado.');

// V89: roda SEMPRE. O script é semanticamente idempotente: um marcador isolado
// não pode mais mascarar uma transformação parcial do CRUD de hierarquia.
execFileSync(process.execPath, ['scripts/patch-hierarchy-v89.mjs'], { stdio: 'inherit' });
bundle = await readFile(bundlePath, 'utf8');

const hierarchyRequirements = [
  ['marcador V89', hierarchyMarker],
  ['nível inicial Departamento', '[a,r]=q.useState("departamento")'],
  ['Departamento sem pai obrigatório', 'if(!d&&a!=="departamento"&&!n)'],
  ['parentId nulo no Departamento', 'parentId:a==="departamento"?null:n'],
  ['ação Novo departamento', 'children:"Novo departamento"'],
  ['seletor de pai oculto no Departamento', '!d&&a!=="departamento"&&l.jsxs'],
  ['placeholder de Departamento', 'a==="departamento"?"Ex.: Food Service"'],
  ['ações editar/excluir em Departamento', 'l.jsx(QF,{node:w,count:w.sections.length,onEdit:S,onDelete:b})'],
  ['Produto consome departamentos da hierarquia', 'ee=t.filter(M=>M.level==="departamento"&&M.status!=="inactive")'],
  ['Produto renderiza departamentos dinâmicos', 'ee.map(M=>l.jsx("option",{value:M.name,children:M.name},M.id))'],
];
for (const [label, token] of hierarchyRequirements) {
  if (!bundle.includes(token)) throw new Error(`Bundle preparado sem requisito de hierarquia: ${label}.`);
}

console.log('Bundle V81 validado com seleção, performance e CRUD completo de hierarquia V89.');

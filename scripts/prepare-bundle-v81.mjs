import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const bundlePath = 'public/assets/index-V60Excel.js';
const marker = 'ASTER_V81_CORE_PATCH';
const whiteScreenMarker = 'ASTER_V81_WHITE_SCREEN_FIX';
const performanceMarker = 'ASTER_V86_EDITOR_PERFORMANCE';
const functionalPolishMarker = 'ASTER_V90_FUNCTIONAL_POLISH';
const group3Marker = 'ASTER_V90_GROUP3_FIXES';

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

// V90 é executado sempre: um marcador de release não prova que cada alteração
// funcional está presente. O script é idempotente e valida transformação por transformação.
execFileSync(process.execPath, ['scripts/patch-functional-polish-v90.mjs'], { stdio: 'inherit' });
bundle = await readFile(bundlePath, 'utf8');
if (!bundle.includes(functionalPolishMarker)) throw new Error('Polimento funcional V90 não foi materializado.');
if (!bundle.includes('children:ee.length?ee.map(M=>l.jsx("option",{value:M.name,children:M.name},M.id))')) {
  throw new Error('V90: seletor dinâmico de Departamento não foi materializado apesar do marcador.');
}
if (bundle.includes('children:[l.jsx("option",{children:"Atacado"}),l.jsx("option",{children:"Distribuição"})]')) {
  throw new Error('V90: seletor fixo Atacado/Distribuição ainda existe após o polimento.');
}

if (!bundle.includes(group3Marker)) execFileSync(process.execPath, ['scripts/patch-group3-v90.mjs'], { stdio: 'inherit' });
bundle = await readFile(bundlePath, 'utf8');
if (!bundle.includes(group3Marker)) throw new Error('Correções finais do Grupo 3 V90 não foram materializadas.');

console.log('Bundle validado com V81, performance V86 e correções funcionais V90 verificadas por conteúdo.');

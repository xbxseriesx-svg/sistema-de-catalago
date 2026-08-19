import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const bundlePath = 'public/assets/index-V60Excel.js';
const marker = 'ASTER_V81_CORE_PATCH';
const whiteScreenMarker = 'ASTER_V81_WHITE_SCREEN_FIX';
const performanceMarker = 'ASTER_V86_EDITOR_PERFORMANCE';

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

  for (const patch of patches) {
    execFileSync(process.execPath, [patch], { stdio: 'inherit' });
  }
  bundle = await readFile(bundlePath, 'utf8');
  if (!bundle.includes(marker)) throw new Error('Cadeia V81 terminou sem materializar o marcador final.');
  console.log('Cadeia completa de patches V81 aplicada com sucesso.');
} else {
  console.log('Bundle V81 já materializado: cadeia legada não será reaplicada.');
}

// Hotfix obrigatório após a V81: corrige ReferenceError no inspetor que causava
// tela branca ao selecionar/editar qualquer objeto e aplica a ação universal no
// renderer público correto. É idempotente e deve rodar inclusive em bundle pronto.
bundle = await readFile(bundlePath, 'utf8');
if (!bundle.includes(whiteScreenMarker)) {
  execFileSync(process.execPath, ['scripts/patch-white-screen-v81.mjs'], { stdio: 'inherit' });
}
bundle = await readFile(bundlePath, 'utf8');
if (!bundle.includes(whiteScreenMarker)) throw new Error('Hotfix V81 de tela branca não foi materializado.');

// V86: o autosave continua com o debounce original de 850 ms, mas deixa de
// serializar a árvore completa do editor em cada atualização de drag/resize.
if (!bundle.includes(performanceMarker)) {
  execFileSync(process.execPath, ['scripts/patch-editor-performance-v86.mjs'], { stdio: 'inherit' });
}
bundle = await readFile(bundlePath, 'utf8');
if (!bundle.includes(performanceMarker)) throw new Error('Hotfix V86 de performance não foi materializado.');
console.log('Bundle V81 validado com hotfixes de seleção e performance V86.');

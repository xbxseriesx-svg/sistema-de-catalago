import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const bundlePath = 'public/assets/index-V60Excel.js';
const marker = 'ASTER_V81_CORE_PATCH';

// O Modelo Oficial é fonte auxiliar independente do bundle e precisa permanecer
// normalizado mesmo quando o bundle V81 já está materializado.
execFileSync(process.execPath, ['scripts/patch-modelo-oficial-v81.mjs'], { stdio: 'inherit' });

const bundle = await readFile(bundlePath, 'utf8');
if (bundle.includes(marker)) {
  console.log('Bundle V81 já materializado: cadeia legada V63/V64/V65/V67/V68/V81 não será reaplicada.');
  process.exit(0);
}

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

const finalBundle = await readFile(bundlePath, 'utf8');
if (!finalBundle.includes(marker)) throw new Error('Cadeia V81 terminou sem materializar o marcador final.');
console.log('Cadeia completa de patches V81 aplicada com sucesso.');

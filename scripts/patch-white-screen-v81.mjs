import fs from 'node:fs';

const path = 'public/assets/index-V60Excel.js';
let source = fs.readFileSync(path, 'utf8');
const MARKER = 'ASTER_V81_WHITE_SCREEN_FIX';

if (source.includes(MARKER)) {
  console.log('Hotfix V81 de tela branca já materializado.');
  process.exit(0);
}

const brokenInspector = '(Q)&&l.jsx(yq,{node:e,updateStyle:s,updateProp:d,mode:t})';
const safeInspector = '(e.type==="button"||e.type==="productbutton")&&l.jsx(yq,{node:e,updateStyle:s,updateProp:d,mode:t})';
if (!source.includes(brokenInspector)) {
  throw new Error('Hotfix V81: condição quebrada Q do inspetor não encontrada.');
}
source = source.replace(brokenInspector, safeInspector);

const restrictedPublicAction = 'y=(d.type==="button"||d.type==="productbutton")&&h.type!=="none"';
const universalPublicAction = 'y=h.type!=="none"';
if (source.includes(restrictedPublicAction)) {
  source = source.replace(restrictedPublicAction, universalPublicAction);
} else if (!source.includes(universalPublicAction)) {
  throw new Error('Hotfix V81: condição de ação do renderer público não encontrada.');
}

const coreMarker = 'const ASTER_V81_CORE_PATCH=true;';
if (!source.includes(coreMarker)) throw new Error('Hotfix V81: marcador do bundle V81 não encontrado.');
source = source.replace(coreMarker, `const ${MARKER}=true,ASTER_V81_CORE_PATCH=true;`);

fs.writeFileSync(path, source);
console.log('Hotfix V81 aplicado: seleção de objetos não derruba o editor e ações públicas permanecem universais.');

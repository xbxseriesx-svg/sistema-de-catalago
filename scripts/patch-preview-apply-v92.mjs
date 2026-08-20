import fs from 'node:fs';

const path = 'public/assets/index-V60Excel.js';
const MARKER = 'ASTER_V92_PREVIEW_APPLY_BRIDGE';
let source = fs.readFileSync(path, 'utf8');

if (source.includes(MARKER)) {
  console.log('Ponte V92 Preview -> React já materializada.');
  process.exit(0);
}

const find = 'const j=oJ(AR(laurenciniNodes(T)),a.products,a.brandName);';
const count = source.split(find).length - 1;
if (count !== 1) throw new Error(`Patch V92: handler de aplicação esperado uma vez, encontrado ${count}.`);

const replacement = `const ${MARKER}=!0,V92A=window.__ASTERYON_PREVIEW_EDITOR_APPLY_V92__,V92N=V92A&&V92A.modelName===b&&V92A.team3Ok===!0&&V92A.team4Ok===!0&&Array.isArray(V92A.nodes)&&Date.now()-Number(V92A.createdAt||0)<15e3?V92A.nodes:null,j=V92N?JSON.parse(JSON.stringify(V92N)):oJ(AR(laurenciniNodes(T)),a.products,a.brandName);V92N&&delete window.__ASTERYON_PREVIEW_EDITOR_APPLY_V92__;`;
source = source.replace(find, replacement);
fs.writeFileSync(path, source);
console.log('Patch V92 aplicado: o handler React consome uma única vez a árvore aprovada do Preview Final.');

import fs from 'node:fs';

const path = 'public/assets/index-V60Excel.js';
const MARKER = 'ASTER_V86_EDITOR_PERFORMANCE';
let source = fs.readFileSync(path, 'utf8');

if (source.includes(MARKER)) {
  console.log('Hotfix V86 de performance do editor já materializado.');
  process.exit(0);
}

const eagerAutosave = 'if(!n||i||s===null||JSON.stringify(t.nodes)===f.current)return;const j=window.setTimeout(()=>{g(r.current.nodes)';
const idleAutosave = 'if(!n||i||s===null)return;const j=window.setTimeout(()=>{if(JSON.stringify(r.current.nodes)===f.current)return;g(r.current.nodes)';
const occurrences = source.split(eagerAutosave).length - 1;
if (occurrences !== 1) {
  throw new Error(`V86: assinatura do autosave encontrada ${occurrences} vez(es); esperado exatamente 1.`);
}
source = source.replace(eagerAutosave, idleAutosave);

// Marcador deliberadamente em comentário: não altera escopo/ordem das constantes
// do bundle minificado e permite que prepare-bundle valide a materialização.
source += `\n/* ${MARKER} */\n`;

fs.writeFileSync(path, source);
console.log('Hotfix V86 aplicado: serialização do autosave movida para depois dos 850 ms de inatividade.');

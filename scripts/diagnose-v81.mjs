import { readFile } from 'node:fs/promises';

const bundle = await readFile('public/assets/index-V60Excel.js', 'utf8');

function allContexts(needle, before = 2600, after = 3000, limit = 8) {
  const output = [];
  let from = 0;
  while (output.length < limit) {
    const index = bundle.indexOf(needle, from);
    if (index < 0) break;
    output.push({ index, text: bundle.slice(Math.max(0, index - before), Math.min(bundle.length, index + needle.length + after)) });
    from = index + needle.length;
  }
  return output;
}

function ownerFunction(index) {
  const head = bundle.slice(Math.max(0, index - 16000), index);
  const matches = [...head.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(/g)];
  return matches.at(-1)?.[1] || '';
}

console.log(`V81 DIAGNÓSTICO ESTRUTURAL bundle bytes=${bundle.length}`);
for (const needle of [
  'l.jsx(yq,{node:',
  'l.jsx(cq,{node:',
  'BN(',
  'previewMode',
  'function HY(',
  'Gestão do Catálogo',
  'VÍNCULOS',
  'Vínculos',
  'OFERTA',
  'Ofertas',
  'Regras',
  'Condições',
]) {
  const hits = allContexts(needle);
  console.log(`\n=== ${needle} :: ${hits.length} ===`);
  hits.forEach((hit, idx) => {
    console.log(`--- ${idx + 1} index=${hit.index} owner=${ownerFunction(hit.index)} ---`);
    console.log(hit.text);
  });
}

const funcs = [...new Set([...bundle.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(\{node:e,/g)].map(m => m[1]))].sort();
console.log('\n=== FUNÇÕES DE INSPETOR COM node=e ===');
console.log(funcs.join('\n'));

import { readFile } from 'node:fs/promises';

const bundle = await readFile('public/assets/index-V60Excel.js', 'utf8');
const keys = [
  'ALINHAMENTO E FUNÇÃO AO CLICAR',
  'Alinhamento',
  'Função ao clicar',
  'Tipo de destino',
  'Seção de destino',
  'Regras',
  'REGRAS',
  'Carrossel',
  'Marketing carregado do Supabase',
  'Promoções e Vitrine de Ofertas',
  'Adicionar vitrine editável',
  'Consulta',
  'Pesquisar',
];

function contexts(needle, limit = 4, radius = 650) {
  const out = [];
  let from = 0;
  while (out.length < limit) {
    const index = bundle.indexOf(needle, from);
    if (index < 0) break;
    out.push(bundle.slice(Math.max(0, index - radius), Math.min(bundle.length, index + needle.length + radius)));
    from = index + needle.length;
  }
  return out;
}

console.log(`V81 DIAGNÓSTICO bundle bytes=${bundle.length}`);
for (const key of keys) {
  const hits = contexts(key);
  console.log(`\n=== ${key} :: ${hits.length} contexto(s) ===`);
  hits.forEach((value, index) => console.log(`--- ${index + 1} ---\n${value}\n`));
}

const quotedActions = [...new Set([
  ...bundle.matchAll(/actionType[:=]["']([^"']+)["']/g),
  ...bundle.matchAll(/["']actionType["']\s*:\s*["']([^"']+)["']/g),
].map(match => match[1]))].sort();
console.log('\n=== ACTION TYPES ENCONTRADOS ===');
console.log(quotedActions.join('\n'));

const apiPaths = [...new Set([...bundle.matchAll(/\/api\/[a-zA-Z0-9_?=&.\/-]+/g)].map(match => match[0]))].sort();
console.log('\n=== API PATHS NO FRONTEND ===');
console.log(apiPaths.join('\n'));

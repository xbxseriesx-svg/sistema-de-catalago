import { readFile } from 'node:fs/promises';

const bundle = await readFile('public/assets/index-V60Excel.js', 'utf8');

function context(needle, before = 3500, after = 3500) {
  const index = bundle.indexOf(needle);
  if (index < 0) return null;
  return { index, text: bundle.slice(Math.max(0, index - before), Math.min(bundle.length, index + needle.length + after)) };
}

function ownerFunction(index) {
  const head = bundle.slice(Math.max(0, index - 12000), index);
  const matches = [...head.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(/g)];
  return matches.at(-1)?.[1] || '';
}

function printNeedle(needle) {
  const hit = context(needle);
  console.log(`\n=== ${needle} ===`);
  if (!hit) return console.log('AUSENTE');
  const owner = ownerFunction(hit.index);
  console.log(`index=${hit.index} ownerFunction=${owner || 'n/a'}`);
  console.log(hit.text);
  if (owner) {
    const invocations = [...bundle.matchAll(new RegExp(`(?:jsx|jsxs)\\(${owner.replace(/[$]/g, '\\$&')}[,)]`, 'g'))].map(m => m.index).slice(0, 12);
    console.log(`INVOCATIONS ${owner}:`, invocations.join(','));
    for (const pos of invocations) console.log(bundle.slice(Math.max(0, pos - 800), Math.min(bundle.length, pos + 900)));
  }
}

console.log(`V81 DIAGNÓSTICO PROFUNDO bundle bytes=${bundle.length}`);
for (const key of [
  'Alinhamento e função ao clicar',
  'function HY(',
  'Promoções e Vitrine de Ofertas',
  'const $j=',
  'const zA=',
  'actionContext',
  'actionEntityId',
  'rules',
  'regras',
  'conditions',
  'condições',
]) printNeedle(key);

const actionStrings = [...new Set([...bundle.matchAll(/["'](none|top|scroll|url|product-info|whatsapp|email|telegram|chat|custom-action|custom-form|modal|popup|catalog|brand|category|promotion)["']/g)].map(m => m[1]))].sort();
console.log('\n=== ACTION STRINGS ===');
console.log(actionStrings.join('\n'));

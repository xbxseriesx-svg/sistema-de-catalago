import { readFile } from 'node:fs/promises';

const source = await readFile('public/assets/index-V60Excel.js', 'utf8');
const needles = [
  'function MJ(',
  'function wJ(',
  'function T_(',
  'function BN(',
  'function v2(',
  'product-info',
  'Produtos similares',
  'Adicionar elemento',
  'Botão',
  'actionType',
  'scroll',
];

console.log(`bundle bytes=${source.length}`);
for (const needle of needles) {
  let offset = 0;
  let count = 0;
  while (count < 12) {
    const index = source.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    const back = 2400;
    const forward = 5200;
    console.log(`\n=== ${needle} #${count} @ ${index} ===\n${source.slice(Math.max(0,index-back), Math.min(source.length,index+needle.length+forward))}\n=== /${needle} ===`);
    offset = index + needle.length;
  }
  if (!count) console.log(`\n=== ${needle}: NOT FOUND ===`);
}

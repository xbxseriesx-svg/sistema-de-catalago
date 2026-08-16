import { readFile } from 'node:fs/promises';

const source = await readFile('public/assets/index-V60Excel.js', 'utf8');
const needles = [
  'function mJ(',
  'mJ({',
  'Abrir menu',
  'Gestão do Catálogo',
  'data-catalog-anchor',
  'Visualizar',
  'Preview',
];

console.log(`bundle bytes=${source.length}`);
for (const needle of needles) {
  let offset = 0;
  let count = 0;
  while (count < 20) {
    const index = source.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    const back = needle === 'mJ({' || needle === 'function mJ(' ? 2600 : 1500;
    const forward = needle === 'mJ({' || needle === 'function mJ(' ? 3600 : 1800;
    const start = Math.max(0, index - back);
    const end = Math.min(source.length, index + needle.length + forward);
    console.log(`\n=== ${needle} #${count} @ ${index} ===\n${source.slice(start, end)}\n=== /${needle} ===`);
    offset = index + needle.length;
  }
  if (!count) console.log(`\n=== ${needle}: NOT FOUND ===`);
}
